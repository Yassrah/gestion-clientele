const db = require('../config/db');
const { STATUTS_CONTRAT, compterDependances, refusSuppression } = require('../utils/integrite');

// GET
const getAllContrat = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT c.*, s.code AS site_code, s.quartier AS site_quartier
             FROM contrat c
             JOIN abonne a ON a.id = c.abonne_id
             LEFT JOIN site s ON s.id = a.site_id
             ORDER BY c.id`
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

const texte = (v) => (v == null ? '' : String(v).trim());

// Contrôle un contrat (création et modification) ; renvoie { erreur } ou les valeurs nettoyées
const validerContrat = async (body) => {
    const numero = texte(body.numero_contrat);
    if (!numero) return { erreur: 'Le numéro de contrat est obligatoire' };
    if (numero.length > 20) return { erreur: 'Le numéro de contrat doit faire 20 caractères maximum' };

    const abonneId = Number(body.abonne_id);
    if (!Number.isInteger(abonneId) || abonneId <= 0) return { erreur: 'L\'abonné est obligatoire' };
    const abonne = await db.query('SELECT id FROM abonne WHERE id = $1', [abonneId]);
    if (abonne.rows.length === 0) return { erreur: 'Abonné introuvable' };

    const type = texte(body.type_contrat);
    if (!type) return { erreur: 'Le type de contrat est obligatoire' };

    const statut = texte(body.statut) || 'Actif';
    if (!STATUTS_CONTRAT.includes(statut)) {
        return { erreur: `Statut invalide (attendu : ${STATUTS_CONTRAT.join(', ')})` };
    }

    if (!body.date_debut || isNaN(new Date(body.date_debut))) {
        return { erreur: 'La date de début est obligatoire' };
    }
    const dateFin = body.date_fin || null;
    if (dateFin && String(dateFin) < String(body.date_debut)) {
        return { erreur: 'La date de fin doit être postérieure à la date de début' };
    }

    let montant = null;
    if (body.montant !== '' && body.montant != null) {
        montant = Number(body.montant);
        if (isNaN(montant) || montant < 0) return { erreur: 'Le montant doit être un nombre positif' };
    }

    return {
        numero_contrat: numero,
        abonne_id: abonneId,
        type_contrat: type,
        date_debut: body.date_debut,
        date_fin: dateFin,
        statut,
        montant
    };
};

const repondreErreur = (res, err) => {
    // 23505 : numéro de contrat déjà utilisé
    if (err.code === '23505') {
        return res.status(400).json({ message: 'Ce numéro de contrat existe déjà' });
    }
    console.error(err);
    res.status(500).json({ message: err.message });
};

// POST
const createContrat = async (req, res) => {
    try {
        const c = await validerContrat(req.body);
        if (c.erreur) {
            return res.status(400).json({ message: c.erreur });
        }

        const result = await db.query(
            `INSERT INTO contrat
            (numero_contrat, abonne_id, type_contrat, date_debut, date_fin, statut, montant)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [c.numero_contrat, c.abonne_id, c.type_contrat, c.date_debut, c.date_fin, c.statut, c.montant]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        repondreErreur(res, err);
    }
};

// PUT
const updateContrat = async (req, res) => {
    try {
        const { id } = req.params;

        const c = await validerContrat(req.body);
        if (c.erreur) {
            return res.status(400).json({ message: c.erreur });
        }

        // Un contrat qui a déjà des relevés ne peut pas changer d'abonné (historique et factures)
        const actuel = (await db.query('SELECT abonne_id FROM contrat WHERE id = $1', [id])).rows[0];
        if (!actuel) {
            return res.status(404).json({ message: 'Contrat introuvable' });
        }
        if (actuel.abonne_id !== c.abonne_id) {
            const { releves } = await compterDependances('contrat', id);
            if (releves > 0) {
                return res.status(409).json({
                    message: `Ce contrat a ${releves} relevé(s) : il ne peut pas être transféré à un autre abonné. Résiliez-le et créez un nouveau contrat.`
                });
            }
        }

        const result = await db.query(
            `UPDATE contrat
             SET numero_contrat = $1,
                 abonne_id = $2,
                 type_contrat = $3,
                 date_debut = $4,
                 date_fin = $5,
                 statut = $6,
                 montant = $7
             WHERE id = $8
             RETURNING *`,
            [c.numero_contrat, c.abonne_id, c.type_contrat, c.date_debut, c.date_fin, c.statut, c.montant, id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        repondreErreur(res, err);
    }
};

// DELETE : refusé si le contrat a des compteurs ou des relevés
const deleteContrat = async (req, res) => {
    try {
        const { id } = req.params;

        const refus = refusSuppression('ce contrat', await compterDependances('contrat', id),
            'Passez plutôt son statut à « Résilié ».');
        if (refus) {
            return res.status(409).json({ message: refus });
        }

        const result = await db.query(
            'DELETE FROM contrat WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Contrat introuvable'
            });
        }

        res.json({
            message: 'Contrat supprimé avec succès',
            contrat: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getAllContrat,
    createContrat,
    updateContrat,
    deleteContrat
};
