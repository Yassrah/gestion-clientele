const db = require('../config/db');

// GET tous les tarifs (avec le nombre de compteurs qui les utilisent)
const getAllTarif = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT t.*, (SELECT count(*)::int FROM compteur c WHERE c.tarif_id = t.id) AS nb_compteurs
             FROM tarif t
             ORDER BY t.id`
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des tarifs'
        });
    }
};

// Contrôle un tarif (création et modification) ; renvoie { erreur } ou les valeurs nettoyées
const validerTarif = (body) => {
    const type = body.type_tarif == null ? '' : String(body.type_tarif).trim();
    if (!type) return { erreur: 'Le type de tarif est obligatoire' };

    const prix = Number(body.prix_unitaire);
    if (body.prix_unitaire === '' || body.prix_unitaire == null || isNaN(prix) || prix <= 0) {
        return { erreur: 'Le prix unitaire doit être un nombre supérieur à 0' };
    }

    if (!body.date_debut || isNaN(new Date(body.date_debut))) {
        return { erreur: 'La date de début de validité est obligatoire' };
    }
    const dateFin = body.date_fin || null;
    if (dateFin && String(dateFin) < String(body.date_debut)) {
        return { erreur: 'La date de fin doit être postérieure à la date de début' };
    }

    return {
        type_tarif: type,
        prix_unitaire: prix,
        date_debut: body.date_debut,
        date_fin: dateFin,
        description: body.description ? String(body.description).trim() : null
    };
};

// POST créer un tarif
const createTarif = async (req, res) => {
    try {
        const t = validerTarif(req.body);
        if (t.erreur) {
            return res.status(400).json({ message: t.erreur });
        }

        const result = await db.query(
            `INSERT INTO tarif
            (type_tarif, prix_unitaire, date_debut, date_fin, description)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [t.type_tarif, t.prix_unitaire, t.date_debut, t.date_fin, t.description]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la création du tarif',
            error: error.message
        });
    }
};

// PUT modifier un tarif (les factures déjà émises gardent leur prix : montants figés)
const putTarif = async (req, res) => {
    try {
        const { id } = req.params;

        const t = validerTarif(req.body);
        if (t.erreur) {
            return res.status(400).json({ message: t.erreur });
        }

        const result = await db.query(
            `UPDATE tarif
             SET type_tarif = $1,
                 prix_unitaire = $2,
                 date_debut = $3,
                 date_fin = $4,
                 description = $5
             WHERE id = $6
             RETURNING *`,
            [t.type_tarif, t.prix_unitaire, t.date_debut, t.date_fin, t.description, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Tarif introuvable'
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la modification du tarif',
            error: error.message
        });
    }
};

// DELETE supprimer un tarif : refusé tant que des compteurs l'utilisent
// (leurs relevés ne pourraient plus être facturés)
const deleteTarif = async (req, res) => {
    try {
        const { id } = req.params;

        const utilise = await db.query(
            'SELECT numero_compteur FROM compteur WHERE tarif_id = $1 ORDER BY numero_compteur',
            [id]
        );
        if (utilise.rows.length > 0) {
            const exemples = utilise.rows.slice(0, 3).map((c) => c.numero_compteur).join(', ');
            const suite = utilise.rows.length > 3 ? '…' : '';
            return res.status(409).json({
                message: `Impossible de supprimer ce tarif : ${utilise.rows.length} compteur(s) l'utilisent (${exemples}${suite}). Associez-leur d'abord un autre tarif.`
            });
        }

        const result = await db.query(
            'DELETE FROM tarif WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Tarif introuvable'
            });
        }

        res.status(200).json({
            message: 'Tarif supprimé avec succès',
            tarif: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la suppression du tarif',
            error: error.message
        });
    }
};

module.exports = {
    getAllTarif,
    createTarif,
    putTarif,
    deleteTarif
};
