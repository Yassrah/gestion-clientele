const fs = require('fs');
const path = require('path');
const db = require('../config/db');

// ---------- Facturation automatique ----------
// Comme à la JIRAMA, une facture regroupe tous les relevés d'un contrat pour un mois
// (électricité et eau) : table facture (une par contrat et par période AAAA-MM) et
// table facture_ligne (une par relevé). Les montants des lignes sont figés : un
// changement de tarif ne modifie pas les factures émises. Une facture impayée est
// recalculée quand un de ses relevés change ; une facture payée n'est plus modifiée.

const TAUX_TAXE_COMMUNALE = 0.05; // 5 %
const TAUX_TVA = 0.20; // 20 %
const DELAI_PAIEMENT_JOURS = 15;

const STATUT_IMPAYEE = 'impayee';
const STATUT_PAYEE = 'payee';

// Facture payée : ses relevés ne peuvent plus changer
class FactureVerrouillee extends Error {}

// Un tarif ne s'applique qu'aux relevés compris dans sa période de validité
const TARIF_VALIDE_SQL =
    'r.date_releve >= t.date_debut AND (t.date_fin IS NULL OR r.date_releve <= t.date_fin)';

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

const createFactureTables = async (client = db) => {
    await client.query(`
        CREATE TABLE IF NOT EXISTS facture (
            id SERIAL PRIMARY KEY,
            numero VARCHAR(30) UNIQUE NOT NULL,
            contrat_id INTEGER NOT NULL REFERENCES contrat(id),
            periode CHAR(7) NOT NULL,
            date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
            date_echeance DATE NOT NULL,
            montant_ht NUMERIC(12, 2) NOT NULL DEFAULT 0,
            taxe_communale NUMERIC(12, 2) NOT NULL DEFAULT 0,
            tva NUMERIC(12, 2) NOT NULL DEFAULT 0,
            total NUMERIC(12, 2) NOT NULL DEFAULT 0,
            statut VARCHAR(10) NOT NULL DEFAULT '${STATUT_IMPAYEE}',
            date_paiement DATE,
            UNIQUE (contrat_id, periode)
        )
    `);
    await client.query(`
        CREATE TABLE IF NOT EXISTS facture_ligne (
            id SERIAL PRIMARY KEY,
            facture_id INTEGER NOT NULL REFERENCES facture(id) ON DELETE CASCADE,
            releve_id INTEGER UNIQUE NOT NULL REFERENCES releve(id) ON DELETE CASCADE,
            type VARCHAR(12) NOT NULL,
            consommation NUMERIC(12, 2) NOT NULL,
            prix_unitaire NUMERIC(12, 2) NOT NULL,
            montant_ht NUMERIC(12, 2) NOT NULL,
            taxe_communale NUMERIC(12, 2) NOT NULL,
            tva NUMERIC(12, 2) NOT NULL,
            total NUMERIC(12, 2) NOT NULL
        )
    `);
};

// N° de facture : FCT + id du contrat sur 6 chiffres + période (ex. FCT000012-202610)
const numeroFacture = (contratId, periode) =>
    `FCT${String(contratId).padStart(6, '0')}-${periode.replace('-', '')}`;

const typeLigne = (typeCompteur) =>
    String(typeCompteur || '').toLowerCase().includes('eau') ? 'eau' : 'electricite';

// Recalcule les totaux d'une facture à partir de ses lignes ; la supprime si elle est vide
const recalculerFacture = async (client, factureId) => {
    const somme = (await client.query(
        `SELECT count(*)::int AS nb,
                COALESCE(sum(montant_ht), 0) AS montant_ht,
                COALESCE(sum(taxe_communale), 0) AS taxe_communale,
                COALESCE(sum(tva), 0) AS tva,
                COALESCE(sum(total), 0) AS total
         FROM facture_ligne WHERE facture_id = $1`,
        [factureId]
    )).rows[0];

    if (somme.nb === 0) {
        await client.query('DELETE FROM facture WHERE id = $1', [factureId]);
        return null;
    }
    return (await client.query(
        `UPDATE facture
         SET montant_ht = $2, taxe_communale = $3, tva = $4, total = $5
         WHERE id = $1
         RETURNING *`,
        [factureId, somme.montant_ht, somme.taxe_communale, somme.tva, somme.total]
    )).rows[0];
};

// Facture (et statut) contenant un relevé, ou null
const factureDuReleve = async (client, releveId) =>
    (await client.query(
        `SELECT f.* FROM facture_ligne fl JOIN facture f ON f.id = fl.facture_id
         WHERE fl.releve_id = $1`,
        [releveId]
    )).rows[0] || null;

// Refuse toute modification d'un relevé dont la facture est payée
const assertModifiable = async (client, releveId) => {
    const facture = await factureDuReleve(client, releveId);
    if (facture && facture.statut === STATUT_PAYEE) {
        throw new FactureVerrouillee(
            `La facture ${facture.numero} est déjà payée : ce relevé ne peut plus être modifié`
        );
    }
};

// Retire un relevé de sa facture (avant sa suppression) et recalcule celle-ci
const retirerReleve = async (client, releveId) => {
    const facture = await factureDuReleve(client, releveId);
    if (!facture) return;
    await client.query('DELETE FROM facture_ligne WHERE releve_id = $1', [releveId]);
    await recalculerFacture(client, facture.id);
};

// Ajoute ou recalcule la ligne d'un relevé dans la facture de son contrat et de son mois.
// Renvoie la facture, ou null si le compteur n'a pas de tarif valide à la date du relevé.
const genererFacture = async (client, releveId) => {
    const r = (await client.query(
        `SELECT r.id, r.contrat_id, r.consommation, to_char(r.date_releve, 'YYYY-MM') AS periode,
                cp.type_compteur, t.prix_unitaire
         FROM releve r
         LEFT JOIN compteur cp ON cp.id = r.compteur_id
         LEFT JOIN tarif t ON t.id = cp.tarif_id AND ${TARIF_VALIDE_SQL}
         WHERE r.id = $1`,
        [releveId]
    )).rows[0];
    if (!r) return null;

    const actuelle = await factureDuReleve(client, releveId);
    if (actuelle && actuelle.statut === STATUT_PAYEE) return actuelle;

    // Plus facturable (tarif retiré ou hors validité) : la ligne est retirée
    if (r.prix_unitaire == null) {
        if (actuelle) await retirerReleve(client, releveId);
        return null;
    }

    // Facture du contrat pour ce mois (créée si besoin)
    let facture = (await client.query(
        'SELECT * FROM facture WHERE contrat_id = $1 AND periode = $2 FOR UPDATE',
        [r.contrat_id, r.periode]
    )).rows[0];
    if (facture && facture.statut === STATUT_PAYEE) {
        throw new FactureVerrouillee(
            `La facture ${facture.numero} de ce mois est déjà payée : aucun relevé ne peut y être ajouté`
        );
    }
    if (!facture) {
        facture = (await client.query(
            `INSERT INTO facture (numero, contrat_id, periode, date_echeance)
             VALUES ($1, $2, $3, CURRENT_DATE + $4::int)
             RETURNING *`,
            [numeroFacture(r.contrat_id, r.periode), r.contrat_id, r.periode, DELAI_PAIEMENT_JOURS]
        )).rows[0];
    }

    // Relevé déplacé vers un autre mois ou un autre contrat : on le retire de l'ancienne facture
    if (actuelle && actuelle.id !== facture.id) {
        await retirerReleve(client, releveId);
    }

    const consommation = Number(r.consommation);
    const prixUnitaire = Number(r.prix_unitaire);
    const montantHT = round2(consommation * prixUnitaire);
    const taxeCommunale = round2(montantHT * TAUX_TAXE_COMMUNALE);
    const tva = round2(montantHT * TAUX_TVA);
    const total = round2(montantHT + taxeCommunale + tva);

    await client.query(
        `INSERT INTO facture_ligne
            (facture_id, releve_id, type, consommation, prix_unitaire, montant_ht, taxe_communale, tva, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (releve_id) DO UPDATE SET
            facture_id = EXCLUDED.facture_id,
            type = EXCLUDED.type,
            consommation = EXCLUDED.consommation,
            prix_unitaire = EXCLUDED.prix_unitaire,
            montant_ht = EXCLUDED.montant_ht,
            taxe_communale = EXCLUDED.taxe_communale,
            tva = EXCLUDED.tva,
            total = EXCLUDED.total`,
        [facture.id, r.id, typeLigne(r.type_compteur), consommation, prixUnitaire,
            montantHT, taxeCommunale, tva, total]
    );

    return recalculerFacture(client, facture.id);
};

// Facture tous les relevés qui n'ont pas encore de ligne de facture (ex. tarif ajouté depuis)
const genererFacturesManquantes = async (client = db) => {
    const manquants = await client.query(
        `SELECT r.id
         FROM releve r
         JOIN compteur cp ON cp.id = r.compteur_id
         JOIN tarif t ON t.id = cp.tarif_id AND ${TARIF_VALIDE_SQL}
         LEFT JOIN facture_ligne fl ON fl.releve_id = r.id
         WHERE fl.id IS NULL
         ORDER BY r.date_releve, r.id`
    );

    let generes = 0;
    for (const { id } of manquants.rows) {
        try {
            if (await genererFacture(client, id)) generes++;
        } catch (error) {
            // Mois déjà payé : le relevé reste hors facture (signalé, sans bloquer)
            if (!(error instanceof FactureVerrouillee)) throw error;
            console.warn(`Relevé ${id} non facturé : ${error.message}`);
        }
    }
    return generes;
};

// Données complètes d'une facture pour l'impression : en-tête, abonné, lignes détaillées
const detailFacture = async (factureId, client = db) => {
    const entete = (await client.query(
        `SELECT f.*, f.numero AS numero_facture,
                c.numero_contrat, c.type_contrat,
                a.numero_abonne, a.nom, a.prenom, a.adresse, a.telephone, a.email,
                s.code AS site_code, s.quartier AS site_quartier
         FROM facture f
         JOIN contrat c ON c.id = f.contrat_id
         JOIN abonne a ON a.id = c.abonne_id
         LEFT JOIN site s ON s.id = a.site_id
         WHERE f.id = $1`,
        [factureId]
    )).rows[0];
    if (!entete) return null;

    const lignes = (await client.query(
        `SELECT fl.*, r.date_releve, r.ancien_index, r.nouvel_index, r.compteur_id,
                cp.numero_compteur, cp.type_compteur, t.type_tarif,
                (SELECT max(p.date_releve) FROM releve p
                 WHERE p.compteur_id = r.compteur_id AND p.id <> r.id
                   AND (p.date_releve, p.id) < (r.date_releve, r.id)) AS date_precedente
         FROM facture_ligne fl
         JOIN releve r ON r.id = fl.releve_id
         LEFT JOIN compteur cp ON cp.id = r.compteur_id
         LEFT JOIN tarif t ON t.id = cp.tarif_id
         WHERE fl.facture_id = $1
         ORDER BY fl.type, r.date_releve, r.id`,
        [factureId]
    )).rows.map((l) => {
        let nombreJours = 30;
        if (l.date_precedente) {
            const diff = Math.round((new Date(l.date_releve) - new Date(l.date_precedente)) / 86400000);
            if (diff > 0) nombreJours = diff;
        }
        return { ...l, nombre_jours: nombreJours };
    });

    return {
        ...entete,
        lignes,
        taux_taxe_communale: TAUX_TAXE_COMMUNALE,
        taux_tva: TAUX_TVA
    };
};

// ---------- Migration : ancienne facture (une par relevé) → facture mensuelle ----------
// Les anciennes factures sont sauvegardées dans backend/backups/, puis regroupées par
// contrat et par mois. Une facture regroupée est payée si tous ses anciens relevés l'étaient.
const migrerFacturesParReleve = async () => {
    const ancienne = await db.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'facture' AND column_name = 'releve_id'"
    );
    if (ancienne.rows.length === 0) return;

    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const anciennes = (await client.query('SELECT * FROM facture ORDER BY id')).rows;

        const dir = path.join(__dirname, '..', 'backups');
        fs.mkdirSync(dir, { recursive: true });
        const fichier = path.join(dir, `factures-avant-regroupement-${Date.now()}.json`);
        fs.writeFileSync(fichier, JSON.stringify(anciennes, null, 2));

        await client.query('DROP TABLE facture');
        await createFactureTables(client);
        await genererFacturesManquantes(client);

        // Report des dates et des paiements des anciennes factures
        const parReleve = new Map(anciennes.map((f) => [f.releve_id, f]));
        const nouvelles = (await client.query(
            'SELECT f.id, array_agg(fl.releve_id) AS releves FROM facture f JOIN facture_ligne fl ON fl.facture_id = f.id GROUP BY f.id'
        )).rows;
        for (const f of nouvelles) {
            const olds = f.releves.map((id) => parReleve.get(id)).filter(Boolean);
            if (olds.length === 0) continue;
            const min = (k) => olds.map((o) => o[k]).filter(Boolean).sort((a, b) => a - b)[0] || null;
            const max = (k) => olds.map((o) => o[k]).filter(Boolean).sort((a, b) => b - a)[0] || null;
            const payee = olds.length === f.releves.length && olds.every((o) => o.statut === STATUT_PAYEE);
            await client.query(
                `UPDATE facture SET date_emission = COALESCE($2, date_emission),
                        date_echeance = COALESCE($3, date_echeance), statut = $4, date_paiement = $5
                 WHERE id = $1`,
                [f.id, max('date_emission'), max('date_echeance'),
                    payee ? STATUT_PAYEE : STATUT_IMPAYEE, payee ? max('date_paiement') : null]
            );
        }

        await client.query('COMMIT');
        console.log(`Factures regroupées par contrat et par mois : ${anciennes.length} anciennes → ` +
            `${nouvelles.length} nouvelles (sauvegarde : ${fichier})`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    TAUX_TAXE_COMMUNALE,
    TAUX_TVA,
    STATUT_IMPAYEE,
    STATUT_PAYEE,
    FactureVerrouillee,
    createFactureTables,
    migrerFacturesParReleve,
    assertModifiable,
    retirerReleve,
    genererFacture,
    genererFacturesManquantes,
    factureDuReleve,
    detailFacture
};
