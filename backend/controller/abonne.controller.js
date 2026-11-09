const db = require('../config/db');
const { normaliserTelephone, normaliserEmail } = require('../utils/validation');
const { compterDependances, refusSuppression } = require('../utils/integrite');

const texte = (v) => (v == null ? '' : String(v).trim());

// Contrôle un abonné (création et modification) ; renvoie { erreur } ou les valeurs nettoyées
const validerAbonne = (body) => {
    const numero = texte(body.numero_abonne);
    if (!numero) {
        return { erreur: 'Le numéro d\'abonné est obligatoire' };
    }
    if (numero.length > 20) {
        return { erreur: 'Le numéro d\'abonné doit faire 20 caractères maximum' };
    }
    if (!texte(body.nom)) {
        return { erreur: 'Le nom est obligatoire' };
    }
    if (!texte(body.prenom)) {
        return { erreur: 'Le prénom est obligatoire' };
    }
    const siteId = Number(body.site_id);
    if (!Number.isInteger(siteId) || siteId <= 0) {
        return { erreur: 'Le site (quartier) est obligatoire' };
    }
    const tel = normaliserTelephone(body.telephone);
    if (tel === null) {
        return { erreur: 'Numéro de téléphone invalide (ex : 0325611411 ou +261325611411)' };
    }
    const mail = normaliserEmail(body.email);
    if (mail === null) {
        return { erreur: 'Adresse email invalide (ex : nom@domaine.com)' };
    }
    return {
        numero_abonne: numero,
        nom: texte(body.nom),
        prenom: texte(body.prenom),
        adresse: texte(body.adresse) || null,
        telephone: tel || null,
        email: mail || null,
        site_id: siteId
    };
};

const repondreErreur = (res, err) => {
    // 23505 : violation de contrainte d'unicité (numéro déjà utilisé)
    if (err.code === '23505') {
        return res.status(400).json({
            message: 'Ce numéro d\'abonné existe déjà'
        });
    }
    // 23503 : site inexistant (clé étrangère abonne.site_id)
    if (err.code === '23503') {
        return res.status(400).json({ message: 'Site introuvable' });
    }
    console.error(err);
    res.status(500).json({ message: err.message });
};

// GET - récupérer tous les abonnés (avec leur site)
const getAllAbonne = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT a.*, s.code AS site_code, s.quartier AS site_quartier, s.ville AS site_ville
             FROM abonne a
             LEFT JOIN site s ON s.id = a.site_id
             ORDER BY a.id`
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
        const a = validerAbonne(req.body);
        if (a.erreur) {
            return res.status(400).json({ message: a.erreur });
        }

        // Le doublon est détecté par la contrainte UNIQUE (voir config/init-db.js)
        const result = await db.query(
            `INSERT INTO abonne
            (numero_abonne, nom, prenom, adresse, telephone, email, site_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                a.numero_abonne,
                a.nom,
                a.prenom,
                a.adresse,
                a.telephone,
                a.email,
                a.site_id
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        repondreErreur(res, err);
    }
};

// PUT - modifier un abonné
const updateAbonne = async (req, res) => {
    try {
        const { id } = req.params;

        // Mêmes règles qu'à la création (numéro, nom, prénom, téléphone, email)
        const a = validerAbonne(req.body);
        if (a.erreur) {
            return res.status(400).json({ message: a.erreur });
        }

        const result = await db.query(
            `UPDATE abonne
             SET numero_abonne = $1,
                 nom = $2,
                 prenom = $3,
                 adresse = $4,
                 telephone = $5,
                 email = $6,
                 site_id = $7
             WHERE id = $8
             RETURNING *`,
            [
                a.numero_abonne,
                a.nom,
                a.prenom,
                a.adresse,
                a.telephone,
                a.email,
                a.site_id,
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
        repondreErreur(res, err);
    }
};

// DELETE - supprimer un abonné (refusé s'il a des compteurs ou des relevés ;
// ses contrats sans compteur sont supprimés avec lui)
const deleteAbonne = async (req, res) => {
    try {
        const { id } = req.params;

        const refus = refusSuppression('cet abonné', await compterDependances('abonne', id),
            'Résiliez plutôt ses contrats.');
        if (refus) {
            return res.status(409).json({ message: refus });
        }

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