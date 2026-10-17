const db = require('../config/db');

// GET
const getAllContrat = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM contrat ORDER BY id'
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// POST
const createContrat = async (req, res) => {
    try {
        const {
            numero_contrat,
            abonne_id,
            type_contrat,
            date_debut,
            date_fin,
            statut,
            montant
        } = req.body;

        const result = await db.query(
            `INSERT INTO contrat
            (numero_contrat, abonne_id, type_contrat, date_debut, date_fin, statut, montant)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                numero_contrat,
                abonne_id,
                type_contrat,
                date_debut,
                date_fin,
                statut,
                montant
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};
const updateContrat = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            type_contrat,
            date_debut,
            date_fin,
            statut,
            montant
        } = req.body;

        const result = await db.query(
            `UPDATE contrat
             SET type_contrat = $1,
                 date_debut = $2,
                 date_fin = $3,
                 statut = $4,
                 montant = $5
             WHERE id = $6
             RETURNING *`,
            [
                type_contrat,
                date_debut,
                date_fin,
                statut,
                montant,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Contrat introuvable'
            });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};
const deleteContrat = async (req, res) => {
    try {
        const { id } = req.params;

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