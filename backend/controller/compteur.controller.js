const db = require('../config/db');
const { genererFacturesManquantes } = require('../service/facture.service');
const { STATUTS_COMPTEUR, compterDependances, refusSuppression } = require('../utils/integrite');

// GET tous les compteurs
const getAllCompteur = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM compteur ORDER BY id'
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des compteurs'
        });
    }
};

// Contrôle un compteur (création et modification) ; renvoie { erreur } ou les valeurs nettoyées.
// Le tarif est obligatoire : sans lui, les relevés du compteur ne peuvent pas être facturés.
const validerCompteur = async (body) => {
    const numero = body.numero_compteur == null ? '' : String(body.numero_compteur).trim();
    if (!numero) {
        return { erreur: 'Le numéro de compteur est obligatoire' };
    }

    if (!body.contrat_id) {
        return { erreur: 'Le contrat est obligatoire' };
    }

    const tarifId = Number(body.tarif_id);
    if (!body.tarif_id || !Number.isInteger(tarifId)) {
        return { erreur: 'Le tarif est obligatoire : sans tarif, les relevés de ce compteur ne peuvent pas être facturés' };
    }
    const tarif = await db.query('SELECT id FROM tarif WHERE id = $1', [tarifId]);
    if (tarif.rows.length === 0) {
        return { erreur: 'Tarif introuvable' };
    }

    const statut = body.statut || 'Actif';
    if (!STATUTS_COMPTEUR.includes(statut)) {
        return { erreur: `Statut invalide (attendu : ${STATUTS_COMPTEUR.join(', ')})` };
    }

    return {
        numero_compteur: numero,
        type_compteur: body.type_compteur || null,
        marque: body.marque || null,
        date_installation: body.date_installation || null,
        statut,
        contrat_id: Number(body.contrat_id),
        tarif_id: tarifId
    };
};

const repondreErreur = (res, error, message) => {
    // 23505 : numéro de compteur déjà utilisé
    if (error.code === '23505') {
        return res.status(400).json({ message: 'Ce numéro de compteur existe déjà' });
    }
    console.error(error);
    res.status(500).json({ message, error: error.message });
};

// POST créer un compteur
const createCompteur = async (req, res) => {
    try {
        const c = await validerCompteur(req.body);
        if (c.erreur) {
            return res.status(400).json({ message: c.erreur });
        }

        const result = await db.query(
            `INSERT INTO compteur
            (numero_compteur, type_compteur, marque,
             date_installation, statut, contrat_id, tarif_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                c.numero_compteur,
                c.type_compteur,
                c.marque,
                c.date_installation,
                c.statut,
                c.contrat_id,
                c.tarif_id
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        repondreErreur(res, error, 'Erreur lors de la création du compteur');
    }
};

// PUT modifier un compteur
const putCompteur = async (req, res) => {
    try {
        const { id } = req.params;

        const c = await validerCompteur(req.body);
        if (c.erreur) {
            return res.status(400).json({ message: c.erreur });
        }

        const result = await db.query(
            `UPDATE compteur
             SET numero_compteur = $1,
                 type_compteur = $2,
                 marque = $3,
                 date_installation = $4,
                 statut = $5,
                 contrat_id = $6,
                 tarif_id = $7
             WHERE id = $8
             RETURNING *`,
            [
                c.numero_compteur,
                c.type_compteur,
                c.marque,
                c.date_installation,
                c.statut,
                c.contrat_id,
                c.tarif_id,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Compteur introuvable'
            });
        }

        // Les relevés restés sans facture (compteur sans tarif jusqu'ici) sont facturés.
        // Les factures déjà émises gardent leur prix (montants figés).
        const generees = await genererFacturesManquantes();

        res.status(200).json({ ...result.rows[0], factures_generees: generees });
    } catch (error) {
        repondreErreur(res, error, 'Erreur lors de la modification du compteur');
    }
};

// DELETE supprimer un compteur
const deleteCompteur = async (req, res) => {
    try {
        const { id } = req.params;

        const refus = refusSuppression('ce compteur', await compterDependances('compteur', id),
            'Passez plutôt son statut à « Hors service ».');
        if (refus) {
            return res.status(409).json({ message: refus });
        }

        const result = await db.query(
            'DELETE FROM compteur WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Compteur introuvable'
            });
        }

        res.status(200).json({
            message: 'Compteur supprimé avec succès',
            compteur: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la suppression du compteur',
            error: error.message
        });
    }
};

module.exports = {
    getAllCompteur,
    createCompteur,
    putCompteur,
   deleteCompteur
};
