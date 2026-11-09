const db = require('./db');
const {
    createFactureTables,
    migrerFacturesParReleve,
    genererFacturesManquantes
} = require('../service/facture.service');

// Crée la table des utilisateurs si elle n'existe pas encore
const initAuthTable = () =>
    db.query(`
        CREATE TABLE IF NOT EXISTS utilisateur (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            nom VARCHAR(100),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

// Rôles : admin (tous les droits) ou agent (saisie et encaissement).
// À l'ajout de la colonne, les comptes existants (qui avaient tous les droits) deviennent admin.
const initRoles = async () => {
    const colonne = await db.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'utilisateur' AND column_name = 'role'"
    );
    if (colonne.rows.length > 0) return;
    await db.query(
        "ALTER TABLE utilisateur ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent'))"
    );
    await db.query("UPDATE utilisateur SET role = 'admin'");
    console.log('Rôles ajoutés : les comptes existants sont administrateurs');
};

// Sites : un quartier identifié par un code (référence de site, ex. 175 = Analakely).
// Les abonnés d'un même quartier partagent le même site.
const initSites = async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS site (
            id SERIAL PRIMARY KEY,
            code VARCHAR(10) UNIQUE NOT NULL,
            quartier VARCHAR(100) NOT NULL,
            ville VARCHAR(100) NOT NULL
        )
    `);
    await db.query('ALTER TABLE abonne ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES site(id)');
};

// Garantit l'unicité de abonne.numero_abonne (si aucun index unique n'existe déjà)
const initAbonneUnique = async () => {
    const existing = await db.query(`
        SELECT 1
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'abonne'::regclass
          AND i.indisunique
          AND i.indnatts = 1
          AND a.attname = 'numero_abonne'
    `);
    if (existing.rows.length === 0) {
        await db.query(
            'CREATE UNIQUE INDEX abonne_numero_abonne_key ON abonne (numero_abonne)'
        );
    }
};

// Clé étrangère compteur.tarif_id → tarif : un tarif utilisé ne peut plus être supprimé en base.
// Non créée s'il reste des compteurs pointant vers un tarif inexistant (à corriger d'abord).
const initCompteurTarifFk = async () => {
    const existe = await db.query(
        "SELECT 1 FROM pg_constraint WHERE conname = 'fk_compteur_tarif'"
    );
    if (existe.rows.length > 0) return;

    const orphelins = await db.query(
        `SELECT numero_compteur FROM compteur c
         WHERE c.tarif_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tarif t WHERE t.id = c.tarif_id)`
    );
    if (orphelins.rows.length > 0) {
        console.error('Clé étrangère compteur → tarif non créée : compteurs avec un tarif inexistant :',
            orphelins.rows.map((r) => r.numero_compteur).join(', '));
        return;
    }
    await db.query(
        'ALTER TABLE compteur ADD CONSTRAINT fk_compteur_tarif FOREIGN KEY (tarif_id) REFERENCES tarif(id)'
    );
};

// contrat.tarif_id n'est utilisé nulle part (le tarif est porté par le compteur) : la colonne
// est supprimée si elle est vide, pour éviter toute confusion.
const supprimerContratTarif = async () => {
    const colonne = await db.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'contrat' AND column_name = 'tarif_id'"
    );
    if (colonne.rows.length === 0) return;

    const utilisee = await db.query('SELECT count(*)::int AS n FROM contrat WHERE tarif_id IS NOT NULL');
    if (utilisee.rows[0].n > 0) {
        console.error(`Colonne contrat.tarif_id conservée : ${utilisee.rows[0].n} contrat(s) la renseignent`);
        return;
    }
    await db.query('ALTER TABLE contrat DROP COLUMN tarif_id');
    console.log('Colonne inutilisée contrat.tarif_id supprimée');
};

// Initialisation au démarrage du serveur
const initDb = async () => {
    await initAuthTable();
    await initRoles();
    await initSites();
    await migrerFacturesParReleve();
    await createFactureTables();
    await initCompteurTarifFk();
    await supprimerContratTarif();

    // Factures des relevés existants (ou ajoutés pendant que le serveur était arrêté)
    const generees = await genererFacturesManquantes();
    if (generees > 0) console.log(`${generees} facture(s) générée(s) au démarrage`);

    try {
        await initAbonneUnique();
    } catch (err) {
        // Ex. : doublons déjà présents en base — à nettoyer manuellement
        console.error('Contrainte d\'unicité sur abonne.numero_abonne non créée :', err.message);
    }
};

module.exports = {
    initAuthTable,
    initRoles,
    initSites,
    initDb
};
