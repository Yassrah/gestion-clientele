const db = require('../config/db');

// GET tous les sites (avec le nombre d'abonnés rattachés)
const getAllSite = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT s.*, (SELECT count(*)::int FROM abonne a WHERE a.site_id = s.id) AS nb_abonnes
             FROM site s
             ORDER BY s.code`
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération des sites' });
    }
};

const texte = (v) => (v == null ? '' : String(v).trim());

// Contrôle un site ; renvoie { erreur } ou les valeurs nettoyées
const validerSite = (body) => {
    const code = texte(body.code);
    if (!code) return { erreur: 'Le code du site est obligatoire' };
    if (!/^\d{1,10}$/.test(code)) return { erreur: 'Le code du site ne contient que des chiffres (10 maximum)' };
    const quartier = texte(body.quartier);
    if (!quartier) return { erreur: 'Le quartier est obligatoire' };
    const ville = texte(body.ville);
    if (!ville) return { erreur: 'La ville est obligatoire' };
    return { code, quartier, ville };
};

const repondreErreur = (res, error, message) => {
    if (error.code === '23505') {
        return res.status(400).json({ message: 'Ce code de site existe déjà' });
    }
    console.error(error);
    res.status(500).json({ message, error: error.message });
};

// POST créer un site
const createSite = async (req, res) => {
    try {
        const s = validerSite(req.body);
        if (s.erreur) return res.status(400).json({ message: s.erreur });

        const result = await db.query(
            'INSERT INTO site (code, quartier, ville) VALUES ($1, $2, $3) RETURNING *',
            [s.code, s.quartier, s.ville]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        repondreErreur(res, error, 'Erreur lors de la création du site');
    }
};

// PUT modifier un site
const putSite = async (req, res) => {
    try {
        const s = validerSite(req.body);
        if (s.erreur) return res.status(400).json({ message: s.erreur });

        const result = await db.query(
            'UPDATE site SET code = $1, quartier = $2, ville = $3 WHERE id = $4 RETURNING *',
            [s.code, s.quartier, s.ville, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Site introuvable' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        repondreErreur(res, error, 'Erreur lors de la modification du site');
    }
};

// DELETE supprimer un site : refusé tant que des abonnés y sont rattachés
const deleteSite = async (req, res) => {
    try {
        const { id } = req.params;
        const nb = (await db.query('SELECT count(*)::int AS n FROM abonne WHERE site_id = $1', [id])).rows[0].n;
        if (nb > 0) {
            return res.status(409).json({
                message: `Impossible de supprimer ce site : ${nb} abonné(s) y sont rattachés. Changez d'abord leur site.`
            });
        }

        const result = await db.query('DELETE FROM site WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Site introuvable' });
        }
        res.status(200).json({ message: 'Site supprimé avec succès', site: result.rows[0] });
    } catch (error) {
        repondreErreur(res, error, 'Erreur lors de la suppression du site');
    }
};

// POST import en masse (fichier Excel lu par le navigateur) : body { sites: [{ ligne, code, quartier, ville }] }.
// Tout ou rien : si une ligne est invalide, rien n'est importé et chaque erreur est renvoyée avec sa ligne.
// Un code déjà existant est mis à jour (quartier, ville) ; les abonnés rattachés sont conservés.
const MAX_LIGNES_IMPORT = 2000;

const importSites = async (req, res) => {
    const lignes = Array.isArray(req.body?.sites) ? req.body.sites : null;
    if (!lignes || lignes.length === 0) {
        return res.status(400).json({ message: 'Aucun site à importer' });
    }
    if (lignes.length > MAX_LIGNES_IMPORT) {
        return res.status(400).json({ message: `Import limité à ${MAX_LIGNES_IMPORT} lignes par fichier` });
    }

    const erreurs = [];
    const valides = [];
    const vus = new Map();
    lignes.forEach((l, i) => {
        const ligne = Number(l.ligne) || i + 2;
        const s = validerSite(l);
        if (s.erreur) {
            erreurs.push({ ligne, message: s.erreur });
        } else if (vus.has(s.code)) {
            erreurs.push({ ligne, message: `Code ${s.code} en double dans le fichier (déjà ligne ${vus.get(s.code)})` });
        } else {
            vus.set(s.code, ligne);
            valides.push(s);
        }
    });
    if (erreurs.length > 0) {
        return res.status(400).json({
            message: `Import annulé : ${erreurs.length} ligne(s) invalide(s), aucun site n'a été enregistré`,
            erreurs
        });
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');
        let crees = 0;
        let misAJour = 0;
        for (const s of valides) {
            // xmax = 0 : ligne insérée ; sinon : ligne existante mise à jour
            const r = await client.query(
                `INSERT INTO site (code, quartier, ville) VALUES ($1, $2, $3)
                 ON CONFLICT (code) DO UPDATE SET quartier = EXCLUDED.quartier, ville = EXCLUDED.ville
                 RETURNING (xmax = 0) AS cree`,
                [s.code, s.quartier, s.ville]
            );
            if (r.rows[0].cree) crees++;
            else misAJour++;
        }
        await client.query('COMMIT');
        res.status(200).json({
            crees,
            mis_a_jour: misAJour,
            message: `Import terminé : ${crees} site(s) créé(s), ${misAJour} mis à jour`
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de l\'import des sites (aucun site enregistré)', error: error.message });
    } finally {
        client.release();
    }
};

module.exports = {
    getAllSite,
    createSite,
    putSite,
    deleteSite,
    importSites
};
