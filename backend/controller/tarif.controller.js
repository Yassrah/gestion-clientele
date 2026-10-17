const db = require('../config/db');

// GET tous les tarifs
const getAllTarif = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM tarif ORDER BY id'
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des tarifs'
        });
    }
};

// POST créer un tarif
const createTarif = async (req, res) => {
    try {
        const {
            type_tarif,
            prix_unitaire,
            date_debut,
            date_fin,
            description
        } = req.body;

        const result = await db.query(
            `INSERT INTO tarif
            (type_tarif, prix_unitaire, date_debut, date_fin, description)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
                type_tarif,
                prix_unitaire,
                date_debut,
                date_fin,
                description
            ]
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

// PUT modifier un tarif
const putTarif = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            type_tarif,
            prix_unitaire,
            date_debut,
            date_fin,
            description
        } = req.body;

        const result = await db.query(
            `UPDATE tarif
             SET type_tarif = $1,
                 prix_unitaire = $2,
                 date_debut = $3,
                 date_fin = $4,
                 description = $5
             WHERE id = $6
             RETURNING *`,
            [
                type_tarif,
                prix_unitaire,
                date_debut,
                date_fin,
                description,
                id
            ]
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

// DELETE supprimer un tarif
const deleteTarif = async (req, res) => {
    try {
        const { id } = req.params;

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
