const db = require('../config/db');

// ---------- Réclamations des abonnés ----------
// Cycle : Ouverte → (prise en charge) En cours → (clôture) Résolue.
// Chaque étape ajoute une ligne de suivi datée, signée par l'utilisateur connecté.

const STATUTS = ['Ouverte', 'En cours', 'Résolue'];

const TYPES = [
    'Contestation de frais',
    'Facture estimée contestée',
    'Surconsommation signalée',
    'Fuite avant compteur',
    'Auto-relevé non pris en compte',
    'Coupure ou absence de service',
    'Qualité de l\'eau',
    'Autre'
];

const CANAUX = ['Guichet', 'Téléphone 3547', 'E-mail service-client', 'Mobile money', 'Courrier', 'Visite terrain'];

const NUMERO_SQL = "'R-' || lpad(r.id::text, 4, '0')";

const SELECT_RECLAMATION = `
    SELECT r.id, ${NUMERO_SQL} AS numero, r.type, r.description, r.canal, r.statut,
           r.date_reception, r.date_resolution, r.abonne_id, r.assignee_id,
           a.numero_abonne, a.nom, a.prenom, a.telephone,
           s.code AS site_code, s.quartier AS site_quartier, s.ville AS agence,
           u.nom AS assignee_nom
    FROM reclamation r
    JOIN abonne a ON a.id = r.abonne_id
    LEFT JOIN site s ON s.id = a.site_id
    LEFT JOIN utilisateur u ON u.id = r.assignee_id`;

const idValide = (v) => {
    const id = Number(v);
    return Number.isInteger(id) && id > 0 ? id : null;
};

// Nom affiché dans le suivi (« T. Rasolo »), à défaut l'identifiant
const signature = async (client, userId) => {
    const u = (await client.query('SELECT nom, username FROM utilisateur WHERE id = $1', [userId])).rows[0];
    return u?.nom || u?.username || 'un agent';
};

const ajouterSuivi = (client, reclamationId, texte, userId) =>
    client.query(
        'INSERT INTO reclamation_suivi (reclamation_id, texte, utilisateur_id) VALUES ($1, $2, $3)',
        [reclamationId, texte, userId]
    );

const avecTransaction = async (fn) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const r = await fn(client);
        await client.query('COMMIT');
        return r;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Fiche complète (réclamation + suivi chronologique)
const lireReclamation = async (id, client = db) => {
    const r = (await client.query(`${SELECT_RECLAMATION} WHERE r.id = $1`, [id])).rows[0];
    if (!r) return null;
    const suivi = (await client.query(
        `SELECT rs.id, rs.date_suivi, rs.texte, u.nom AS auteur
         FROM reclamation_suivi rs
         LEFT JOIN utilisateur u ON u.id = rs.utilisateur_id
         WHERE rs.reclamation_id = $1
         ORDER BY rs.date_suivi, rs.id`,
        [id]
    )).rows;
    return { ...r, suivi };
};

const erreur500 = (res, error, message) => {
    console.error(error);
    res.status(500).json({ message, error: error.message });
};

// GET liste (récentes d'abord) + listes de choix du formulaire
const getAllReclamation = async (req, res) => {
    try {
        const result = await db.query(`${SELECT_RECLAMATION} ORDER BY r.date_reception DESC, r.id DESC`);
        res.status(200).json({ reclamations: result.rows, types: TYPES, canaux: CANAUX, statuts: STATUTS });
    } catch (error) {
        erreur500(res, error, 'Erreur lors de la récupération des réclamations');
    }
};

// GET nombre de réclamations non résolues (pastille du menu)
const compterOuvertes = async (req, res) => {
    try {
        const r = await db.query("SELECT count(*)::int AS n FROM reclamation WHERE statut <> 'Résolue'");
        res.status(200).json({ non_resolues: r.rows[0].n });
    } catch (error) {
        erreur500(res, error, 'Erreur lors du comptage des réclamations');
    }
};

// GET fiche
const getReclamation = async (req, res) => {
    try {
        const id = idValide(req.params.id);
        if (!id) return res.status(400).json({ message: 'Identifiant de réclamation invalide' });
        const r = await lireReclamation(id);
        if (!r) return res.status(404).json({ message: 'Réclamation introuvable' });
        res.status(200).json(r);
    } catch (error) {
        erreur500(res, error, 'Erreur lors de la récupération de la réclamation');
    }
};

// POST enregistrer une réclamation
const createReclamation = async (req, res) => {
    try {
        const abonneId = idValide(req.body.abonne_id);
        const type = String(req.body.type || '').trim();
        const canal = String(req.body.canal || '').trim();
        const description = String(req.body.description || '').trim();
        if (!abonneId) return res.status(400).json({ message: 'L\'abonné est obligatoire' });
        if (!TYPES.includes(type)) return res.status(400).json({ message: 'Type de réclamation invalide' });
        if (!canal || canal.length > 80) return res.status(400).json({ message: 'Le canal de réception est obligatoire' });
        if (description.length < 10) {
            return res.status(400).json({ message: 'Décrivez la réclamation (10 caractères minimum)' });
        }

        const abonne = await db.query('SELECT id FROM abonne WHERE id = $1', [abonneId]);
        if (abonne.rows.length === 0) return res.status(400).json({ message: 'Abonné introuvable' });

        const r = await avecTransaction(async (client) => {
            const { id } = (await client.query(
                `INSERT INTO reclamation (abonne_id, type, description, canal)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [abonneId, type, description, canal]
            )).rows[0];
            await ajouterSuivi(client, id, `Réclamation enregistrée (${canal}).`, req.user.id);
            return lireReclamation(id, client);
        });
        res.status(201).json(r);
    } catch (error) {
        erreur500(res, error, 'Erreur lors de l\'enregistrement de la réclamation');
    }
};

// Action sur une réclamation existante : contrôle d'état puis mise à jour + ligne de suivi
const action = (verifier, appliquer) => async (req, res) => {
    try {
        const id = idValide(req.params.id);
        if (!id) return res.status(400).json({ message: 'Identifiant de réclamation invalide' });

        const r = await avecTransaction(async (client) => {
            const actuelle = (await client.query('SELECT * FROM reclamation WHERE id = $1 FOR UPDATE', [id])).rows[0];
            if (!actuelle) return { code: 404, message: 'Réclamation introuvable' };
            const refus = verifier(actuelle, req);
            if (refus) return { code: 409, message: refus };
            const qui = await signature(client, req.user.id);
            await appliquer(client, actuelle, req, qui);
            return { fiche: await lireReclamation(id, client) };
        });

        if (r.code) return res.status(r.code).json({ message: r.message });
        res.status(200).json(r.fiche);
    } catch (error) {
        erreur500(res, error, 'Erreur lors de la mise à jour de la réclamation');
    }
};

// PUT /:id/prendre — « Prendre en charge » (Ouverte → En cours, assignée à l'utilisateur connecté)
const prendreEnCharge = action(
    (r) => (r.statut !== 'Ouverte' ? `Réclamation déjà « ${r.statut} »` : null),
    async (client, r, req, qui) => {
        await client.query("UPDATE reclamation SET statut = 'En cours', assignee_id = $2 WHERE id = $1", [r.id, req.user.id]);
        await ajouterSuivi(client, r.id, `Prise en charge par ${qui}.`, req.user.id);
    }
);

// POST /:id/controle — « Demander un relevé de contrôle » (trace dans le suivi)
const demanderControle = action(
    (r) => (r.statut === 'Résolue' ? 'Réclamation déjà résolue' : null),
    async (client, r, req, qui) => {
        const agence = (await client.query(
            'SELECT s.ville FROM abonne a LEFT JOIN site s ON s.id = a.site_id WHERE a.id = $1',
            [r.abonne_id]
        )).rows[0]?.ville;
        await ajouterSuivi(client, r.id,
            `Relevé de contrôle demandé au releveur${agence ? ` de ${agence}` : ''} (par ${qui}).`, req.user.id);
    }
);

// PUT /:id/cloturer — « Clôturer · résolue » (commentaire de résolution facultatif)
const cloturer = action(
    (r) => (r.statut === 'Résolue' ? 'Réclamation déjà résolue' : null),
    async (client, r, req, qui) => {
        const commentaire = String(req.body?.commentaire || '').trim();
        await client.query(
            `UPDATE reclamation SET statut = 'Résolue', date_resolution = CURRENT_DATE,
                    assignee_id = COALESCE(assignee_id, $2)
             WHERE id = $1`,
            [r.id, req.user.id]
        );
        await ajouterSuivi(client, r.id,
            `Réclamation clôturée par ${qui}${commentaire ? ` : ${commentaire}` : '.'}`, req.user.id);
    }
);

// POST /:id/suivi — ajouter une note au suivi
const ajouterNote = action(
    (r, req) => (String(req.body?.texte || '').trim().length < 3 ? 'Note trop courte' : null),
    async (client, r, req) => {
        await ajouterSuivi(client, r.id, String(req.body.texte).trim(), req.user.id);
    }
);

// DELETE (admin) — erreur de saisie uniquement
const deleteReclamation = async (req, res) => {
    try {
        const id = idValide(req.params.id);
        if (!id) return res.status(400).json({ message: 'Identifiant de réclamation invalide' });
        const r = await db.query('DELETE FROM reclamation WHERE id = $1 RETURNING id', [id]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Réclamation introuvable' });
        res.status(200).json({ message: 'Réclamation supprimée' });
    } catch (error) {
        erreur500(res, error, 'Erreur lors de la suppression de la réclamation');
    }
};

module.exports = {
    getAllReclamation,
    compterOuvertes,
    getReclamation,
    createReclamation,
    prendreEnCharge,
    demanderControle,
    cloturer,
    ajouterNote,
    deleteReclamation
};
