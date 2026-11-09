const db = require('../config/db');
const {
    FactureVerrouillee,
    assertModifiable,
    retirerReleve,
    genererFacture,
    factureDuReleve,
    detailFacture
} = require('../service/facture.service');
const { contratActif, compteurActif } = require('../utils/integrite');

// Date pg (objet Date à minuit local) → jj/mm/aaaa
const formatJour = (d) => new Date(d).toLocaleDateString('fr-FR');

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
                r.consommation,
                c.numero_contrat,
                a.nom,
                a.prenom,
                a.numero_abonne,
                s.code AS site_code,
                s.quartier AS site_quartier,
                cp.numero_compteur,
                cp.type_compteur,
                f.numero AS numero_facture,
                f.statut AS statut_facture
            FROM releve r
            JOIN contrat c ON c.id = r.contrat_id
            JOIN abonne a ON a.id = c.abonne_id
            LEFT JOIN site s ON s.id = a.site_id
            LEFT JOIN compteur cp ON cp.id = r.compteur_id
            LEFT JOIN facture_ligne fl ON fl.releve_id = r.id
            LEFT JOIN facture f ON f.id = fl.facture_id
            ORDER BY r.date_releve DESC, r.id DESC
        `);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des relevés'
        });
    }
};

// Montant HT d'un relevé au tarif actuel (utilisé si le relevé n'est pas encore facturé)
const MONTANT_SQL = 'ROUND((r.consommation * t.prix_unitaire)::numeric, 2)';

// ---------- Chaînage des index par compteur ----------
// Les relevés d'un compteur sont ordonnés par (date_releve, id). L'ancien index d'un
// relevé est le nouvel index du relevé précédent du même compteur ; il n'est saisi
// que pour le tout premier relevé du compteur (nouvel abonné).

// Erreur de saisie : renvoyée au client en 400
class ReleveInvalide extends Error {}

// Position "après tous les relevés du jour" pour un relevé pas encore créé
const ID_MAX = 2147483647;

const withTransaction = async (fn) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const findPrecedent = async (client, compteurId, date, id) =>
    (await client.query(
        `SELECT id, date_releve, nouvel_index
         FROM releve
         WHERE compteur_id = $1 AND id <> $3 AND (date_releve, id) < ($2::date, $3::int)
         ORDER BY date_releve DESC, id DESC
         LIMIT 1`,
        [compteurId, date, id]
    )).rows[0] || null;

const findSuivant = async (client, compteurId, date, id) =>
    (await client.query(
        `SELECT id, date_releve, nouvel_index
         FROM releve
         WHERE compteur_id = $1 AND id <> $3 AND (date_releve, id) > ($2::date, $3::int)
         ORDER BY date_releve, id
         LIMIT 1`,
        [compteurId, date, id]
    )).rows[0] || null;

// Reporte un index sur le relevé suivant (ancien index + consommation) et
// recalcule sa facture. Refusé si cela changerait une facture déjà payée.
const majSuivant = async (client, suivantId, ancienIndex) => {
    const actuel = (await client.query(
        'SELECT ancien_index FROM releve WHERE id = $1',
        [suivantId]
    )).rows[0];
    if (!actuel || Number(actuel.ancien_index) === Number(ancienIndex)) return;

    await assertModifiable(client, suivantId);
    await client.query(
        `UPDATE releve
         SET ancien_index = $2, consommation = nouvel_index - $2
         WHERE id = $1`,
        [suivantId, ancienIndex]
    );
    await genererFacture(client, suivantId);
};

// Contrôle la saisie et calcule l'ancien index à partir du relevé précédent
const prepareReleve = async (client, body, id) => {
    const { compteur_id, date_releve, ancien_index, nouvel_index } = body;

    if (!compteur_id) {
        throw new ReleveInvalide('Le compteur est obligatoire');
    }
    if (!date_releve || isNaN(new Date(date_releve))) {
        throw new ReleveInvalide('La date du relevé est obligatoire');
    }
    if (nouvel_index === '' || nouvel_index == null || isNaN(Number(nouvel_index))) {
        throw new ReleveInvalide('Le nouvel index doit être un nombre');
    }

    // Verrou sur le compteur : deux saisies simultanées ne lisent pas le même précédent
    const compteur = (await client.query(
        `SELECT cp.id, cp.contrat_id, cp.numero_compteur, cp.statut,
                c.numero_contrat, c.statut AS statut_contrat,
                t.id AS tarif_id, t.type_tarif, t.date_debut AS tarif_debut, t.date_fin AS tarif_fin,
                ($2::date >= t.date_debut AND (t.date_fin IS NULL OR $2::date <= t.date_fin)) AS tarif_valide
         FROM compteur cp
         JOIN contrat c ON c.id = cp.contrat_id
         LEFT JOIN tarif t ON t.id = cp.tarif_id
         WHERE cp.id = $1
         FOR UPDATE OF cp`,
        [compteur_id, date_releve]
    )).rows[0];
    if (!compteur) {
        throw new ReleveInvalide('Compteur introuvable');
    }

    // Nouveaux relevés uniquement sur un contrat actif et un compteur en service
    // (la correction d'un relevé existant reste possible)
    if (id === ID_MAX) {
        if (!contratActif(compteur.statut_contrat)) {
            throw new ReleveInvalide(
                `Le contrat ${compteur.numero_contrat} est « ${compteur.statut_contrat} » : aucun nouveau relevé n'est possible`
            );
        }
        if (!compteurActif(compteur.statut)) {
            throw new ReleveInvalide(
                `Le compteur ${compteur.numero_compteur} est « ${compteur.statut} » : aucun nouveau relevé n'est possible`
            );
        }
    }

    // Le relevé doit pouvoir être facturé : tarif du compteur valide à la date du relevé
    if (!compteur.tarif_id) {
        throw new ReleveInvalide(`Le compteur ${compteur.numero_compteur} n'a pas de tarif : associez-lui un tarif`);
    }
    if (!compteur.tarif_valide) {
        const fin = compteur.tarif_fin ? ` au ${formatJour(compteur.tarif_fin)}` : '';
        throw new ReleveInvalide(
            `Le tarif « ${compteur.type_tarif} » du compteur n'est pas valide à cette date ` +
            `(valable du ${formatJour(compteur.tarif_debut)}${fin}). Changez le tarif du compteur ou la date du relevé.`
        );
    }

    const nouvel = Number(nouvel_index);
    const precedent = await findPrecedent(client, compteur.id, date_releve, id);

    let ancien;
    if (precedent) {
        ancien = Number(precedent.nouvel_index);
    } else if (ancien_index === '' || ancien_index == null || isNaN(Number(ancien_index))) {
        throw new ReleveInvalide("Premier relevé de ce compteur : l'ancien index est obligatoire");
    } else {
        ancien = Number(ancien_index);
    }

    if (nouvel < ancien) {
        throw new ReleveInvalide(
            `Le nouvel index (${nouvel}) doit être supérieur ou égal à l'ancien index (${ancien})`
        );
    }

    const suivant = await findSuivant(client, compteur.id, date_releve, id);
    if (suivant && Number(suivant.nouvel_index) < nouvel) {
        throw new ReleveInvalide(
            `Le relevé suivant de ce compteur a un index (${Number(suivant.nouvel_index)}) inférieur au nouvel index saisi`
        );
    }

    return {
        contrat_id: body.contrat_id || compteur.contrat_id,
        compteur_id: compteur.id,
        date_releve,
        ancien_index: ancien,
        nouvel_index: nouvel,
        consommation: nouvel - ancien,
        suivant
    };
};

const repondreErreur = (res, error, message) => {
    if (error instanceof ReleveInvalide) {
        return res.status(400).json({ message: error.message });
    }
    if (error instanceof FactureVerrouillee) {
        return res.status(409).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message, error: error.message });
};

// POST créer un relevé
const createReleve = async (req, res) => {
    try {
        const releve = await withTransaction(async (client) => {
            const r = await prepareReleve(client, req.body, ID_MAX);

            const result = await client.query(
                `INSERT INTO releve
                (contrat_id, compteur_id, date_releve, ancien_index, nouvel_index, consommation)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *`,
                [r.contrat_id, r.compteur_id, r.date_releve, r.ancien_index, r.nouvel_index, r.consommation]
            );

            // Relevé saisi avant un relevé existant : le suivant repart de ce nouvel index
            if (r.suivant) await majSuivant(client, r.suivant.id, r.nouvel_index);

            // Facturation automatique (null si le compteur n'a pas de tarif)
            const facture = await genererFacture(client, result.rows[0].id);

            return { ...result.rows[0], facture };
        });

        res.status(201).json(releve);
    } catch (error) {
        repondreErreur(res, error, 'Erreur lors de la création du relevé');
    }
};

// PUT modifier un relevé
const putReleve = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Identifiant de relevé invalide' });
        }

        const releve = await withTransaction(async (client) => {
            const avant = (await client.query(
                'SELECT * FROM releve WHERE id = $1 FOR UPDATE',
                [id]
            )).rows[0];
            if (!avant) return null;
            await assertModifiable(client, id);

            const r = await prepareReleve(client, req.body, id);

            const result = await client.query(
                `UPDATE releve
                 SET contrat_id = $1,
                     compteur_id = $2,
                     date_releve = $3,
                     ancien_index = $4,
                     nouvel_index = $5,
                     consommation = $6
                 WHERE id = $7
                 RETURNING *`,
                [r.contrat_id, r.compteur_id, r.date_releve, r.ancien_index, r.nouvel_index, r.consommation, id]
            );

            // Si le relevé a changé de place (compteur ou date), on referme le trou laissé
            if (avant.compteur_id) {
                const ancienSuivant = await findSuivant(client, avant.compteur_id, avant.date_releve, id);
                const ancienPrecedent = await findPrecedent(client, avant.compteur_id, avant.date_releve, id);
                if (ancienSuivant && ancienPrecedent && ancienSuivant.id !== r.suivant?.id) {
                    await majSuivant(client, ancienSuivant.id, ancienPrecedent.nouvel_index);
                }
            }

            // Le relevé suivant repart du nouvel index de celui-ci
            if (r.suivant) await majSuivant(client, r.suivant.id, r.nouvel_index);

            const facture = await genererFacture(client, id);

            return { ...result.rows[0], facture };
        });

        if (!releve) {
            return res.status(404).json({
                message: 'Relevé introuvable'
            });
        }

        res.status(200).json(releve);
    } catch (error) {
        repondreErreur(res, error, 'Erreur lors de la modification du relevé');
    }
};

// DELETE supprimer un relevé
const deleteReleve = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Identifiant de relevé invalide' });
        }

        const releve = await withTransaction(async (client) => {
            // Retiré de sa facture (impayée), qui est recalculée ou supprimée si elle devient vide
            await assertModifiable(client, id);
            await retirerReleve(client, id);

            const result = await client.query(
                `DELETE FROM releve
                 WHERE id = $1
                 RETURNING *`,
                [id]
            );
            const supprime = result.rows[0];
            if (!supprime) return null;

            // Le relevé suivant repart du nouvel index du relevé précédent
            if (supprime.compteur_id) {
                const suivant = await findSuivant(client, supprime.compteur_id, supprime.date_releve, id);
                const precedent = await findPrecedent(client, supprime.compteur_id, supprime.date_releve, id);
                if (suivant && precedent) {
                    await majSuivant(client, suivant.id, precedent.nouvel_index);
                }
            }

            return supprime;
        });

        if (!releve) {
            return res.status(404).json({
                message: 'Relevé introuvable'
            });
        }

        res.status(200).json({
            message: 'Relevé supprimé avec succès',
            releve
        });
    } catch (error) {
        repondreErreur(res, error, 'Erreur lors de la suppression du relevé');
    }
};

// GET relevés d'un abonné par son nom
const getReleveByAbonne = async (req, res) => {
    try {
        const { nom } = req.params;

        const result = await db.query(
            `SELECT
                r.id,
                a.nom,
                a.prenom,
                cp.numero_compteur,
                cp.type_compteur AS type,
                t.type_tarif AS tarif,
                r.date_releve,
                r.ancien_index,
                r.nouvel_index,
                r.consommation,
                COALESCE(fl.prix_unitaire, t.prix_unitaire) AS prix_unitaire,
                COALESCE(fl.montant_ht, ${MONTANT_SQL}) AS montant,
                f.numero AS numero_facture,
                f.statut AS statut_facture
             FROM abonne a
             JOIN contrat c ON c.abonne_id = a.id
             JOIN releve r ON r.contrat_id = c.id
             JOIN compteur cp ON cp.id = r.compteur_id
             JOIN tarif t ON t.id = cp.tarif_id
             LEFT JOIN facture_ligne fl ON fl.releve_id = r.id
             LEFT JOIN facture f ON f.id = fl.facture_id
             WHERE a.nom ILIKE $1
                OR a.prenom ILIKE $1
                OR (a.prenom || ' ' || a.nom) ILIKE $1
                OR (a.nom || ' ' || a.prenom) ILIKE $1
                OR a.numero_abonne ILIKE $1
             ORDER BY a.nom, a.prenom, cp.numero_compteur, r.date_releve`,
            // Recherche partielle : « rakoto », « Hery », « AB0001 »…
            [`%${String(nom).trim().replace(/[%_\\]/g, '\\$&')}%`]
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

// GET facture imprimable d'un relevé : la facture mensuelle de son contrat qui le contient
const getFactureReleve = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Identifiant de relevé invalide' });
        }

        const existe = await db.query('SELECT id FROM releve WHERE id = $1', [id]);
        if (existe.rows.length === 0) {
            return res.status(404).json({ message: 'Relevé introuvable' });
        }

        // Relevé pas encore facturé (ex. tarif ajouté au compteur depuis) : on facture maintenant
        let facture = await factureDuReleve(db, id);
        if (!facture) facture = await genererFacture(db, id);
        if (!facture) {
            return res.status(422).json({
                message: "Impossible de générer la facture : le compteur de ce relevé n'a pas de tarif valide à la date du relevé"
            });
        }

        res.status(200).json(await detailFacture(facture.id));
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la génération de la facture',
            error: error.message
        });
    }
};

module.exports = {
    getAllReleve,
    createReleve,
    putReleve,
    deleteReleve,
    getReleveByAbonne,
    getFactureReleve
};
