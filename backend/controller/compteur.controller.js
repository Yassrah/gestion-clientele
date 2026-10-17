const db = require('../config/db');

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

// POST créer un compteur
const createCompteur = async (req, res) => {
    try {
        const {
            numero_compteur,
            type_compteur,
            marque,
            date_installation,
            statut,
            contrat_id
        } = req.body;

        const result = await db.query(
            `INSERT INTO compteur
            (numero_compteur, type_compteur, marque,
             date_installation, statut, contrat_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                numero_compteur,
                type_compteur,
                marque,
                date_installation,
                statut,
                contrat_id
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la création du compteur',
            error: error.message
        });
    }
};

// PUT modifier un compteur
const putCompteur = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            numero_compteur,
            type_compteur,
            marque,
            date_installation,
            statut,
            contrat_id
        } = req.body;

        const result = await db.query(
            `UPDATE compteur
             SET numero_compteur = $1,
                 type_compteur = $2,
                 marque = $3,
                 date_installation = $4,
                 statut = $5,
                 contrat_id = $6
             WHERE id = $7
             RETURNING *`,
            [
                numero_compteur,
                type_compteur,
                marque,
                date_installation,
                statut,
                contrat_id,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Compteur introuvable'
            });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la modification du compteur',
            error: error.message
        });
    }
};

// DELETE supprimer un compteur
const deleteCompteur = async (req, res) => {
    try {
        const { id } = req.params;

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
