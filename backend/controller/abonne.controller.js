const db = require('../config/db');

// GET - récupérer tous les abonnés
const getAllAbonne = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM abonne ORDER BY id'
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// POST - ajouter un abonné
const createAbonne = async (req, res) => {
    try {
        const {
            numero_abonne,
            nom,
            prenom,
            adresse,
            telephone,
            email
        } = req.body;

        const result = await db.query(
            `INSERT INTO abonne
            (numero_abonne, nom, prenom, adresse, telephone, email)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                numero_abonne,
                nom,
                prenom,
                adresse,
                telephone,
                email
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// PUT - modifier un abonné
const updateAbonne = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nom,
            prenom,
            adresse,
            telephone,
            email
        } = req.body;

        const result = await db.query(
            `UPDATE abonne
             SET nom = $1,
                 prenom = $2,
                 adresse = $3,
                 telephone = $4,
                 email = $5
             WHERE id = $6
             RETURNING *`,
            [
                nom,
                prenom,
                adresse,
                telephone,
                email,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Abonné introuvable'
            });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// DELETE - supprimer un abonné
const deleteAbonne = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM abonne WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Abonné introuvable'
            });
        }

        res.json({
            message: 'Abonné supprimé avec succès',
            abonne: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getAllAbonne,
    createAbonne,
    updateAbonne,
    deleteAbonne
};