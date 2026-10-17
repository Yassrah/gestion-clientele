const db = require('../config/db');

// GET tous les relevés
const getAllReleve = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                r.id,
                r.contrat_id,
                r.compteur_id,
                r.date_releve,
                r.ancien_index,
                r.nouvel_index,
                r.consommation
            FROM releve r
            ORDER BY r.id
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des relevés'
        });
    }
};

// POST créer un relevé
const createReleve = async (req, res) => {
    try {
        const {
            contrat_id,
            compteur_id,
            date_releve,
            ancien_index,
            nouvel_index
        } = req.body;

        const consommation = nouvel_index - ancien_index;

        const result = await db.query(
            `INSERT INTO releve
            (contrat_id, compteur_id, date_releve, ancien_index, nouvel_index, consommation)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                contrat_id,
                compteur_id,
                date_releve,
                ancien_index,
                nouvel_index,
                consommation
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la création du relevé',
            error: error.message
        });
    }
};

// PUT modifier un relevé
const putReleve = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            contrat_id,
            compteur_id,
            date_releve,
            ancien_index,
            nouvel_index
        } = req.body;

        const consommation = nouvel_index - ancien_index;

        const result = await db.query(
            `UPDATE releve
             SET contrat_id = $1,
                 compteur_id = $2,
                 date_releve = $3,
                 ancien_index = $4,
                 nouvel_index = $5,
                 consommation = $6
             WHERE id = $7
             RETURNING *`,
            [
                contrat_id,
                compteur_id,
                date_releve,
                ancien_index,
                nouvel_index,
                consommation,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Relevé introuvable'
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la modification du relevé',
            error: error.message
        });
    }
};

// DELETE supprimer un relevé
const deleteReleve = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `DELETE FROM releve
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Relevé introuvable'
            });
        }

        res.status(200).json({
            message: 'Relevé supprimé avec succès',
            releve: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la suppression du relevé',
            error: error.message
        });
    }
};

// GET relevés d'un abonné par son nom
const getReleveByAbonne = async (req, res) => {
    try {
        const { nom } = req.params;

        const result = await db.query(
            `SELECT
                a.nom,
                a.prenom,
                cp.numero_compteur,
                cp.type_compteur AS type,
                t.type_tarif AS tarif,
                r.date_releve,
                r.ancien_index,
                r.nouvel_index,
                r.consommation,
                t.prix_unitaire,
                (r.consommation * t.prix_unitaire) AS montant
             FROM abonne a
             JOIN contrat c ON c.abonne_id = a.id
             JOIN releve r ON r.contrat_id = c.id
             JOIN compteur cp ON cp.id = r.compteur_id
             JOIN tarif t ON t.id = cp.tarif_id
             WHERE UPPER(a.nom) = UPPER($1)
             ORDER BY r.date_releve`,
            [nom]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la récupération du relevé',
            error: error.message
        });
    }
};

module.exports = {
    getAllReleve,
    createReleve,
    putReleve,
    deleteReleve,
    getReleveByAbonne
};
