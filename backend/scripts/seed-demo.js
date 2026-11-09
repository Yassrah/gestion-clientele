// Remplace les données de l'application par un jeu de données réaliste (province de Toliara).
// Usage : npm run seed
//
// 1. Sauvegarde les tables de l'application dans backend/backups/ (JSON)
// 2. Vide abonne, contrat, compteur, tarif, releve, facture (les comptes utilisateur sont conservés)
// 3. Insère abonnés, contrats, compteurs, tarifs et 6 mois de relevés chaînés,
//    puis génère les factures mensuelles (eau + électricité par contrat), paiements simulés
// Tout se fait dans une transaction : en cas d'erreur, rien n'est modifié.
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { createFactureTables, genererFacture, STATUT_PAYEE } = require('../service/facture.service');
const { initSites } = require('../config/init-db');

const TABLES = ['site', 'abonne', 'contrat', 'tarif', 'compteur', 'releve', 'facture', 'facture_ligne'];

// Générateur pseudo-aléatoire déterministe : le jeu de données est identique à chaque exécution
let graine = 20261107;
const alea = () => {
    graine = (graine * 1103515245 + 12345) % 2147483648;
    return graine / 2147483648;
};
const entre = (min, max) => Math.floor(min + alea() * (max - min + 1));

const iso = (d) => d.toISOString().slice(0, 10);
const plusJours = (dateIso, n) => {
    const d = new Date(`${dateIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
};

// ---------- Données ----------

// Tarifs indicatifs (tarif unique par unité, sans tranches)
const TARIFS = [
    { cle: 'elec-dom', type_tarif: 'Électricité T10', prix: 680, description: 'Électricité basse tension — usage domestique (kWh)' },
    { cle: 'elec-pro', type_tarif: 'Électricité T14', prix: 845, description: 'Électricité basse tension — usage professionnel (kWh)' },
    { cle: 'eau-dom', type_tarif: 'Eau domestique', prix: 1150, description: 'Eau potable — usage domestique (m³)' },
    { cle: 'eau-pro', type_tarif: 'Eau professionnelle', prix: 1780, description: 'Eau potable — usage professionnel (m³)' }
];

// Sites (références de site) de l'ancienne province de Toliara : un quartier par code.
// 6xx = province de Toliara ; 61x Toliara ville, 62x Morondava (Menabe),
// 63x Taolagnaro (Anosy), 64x Ambovombe (Androy).
const SITES = [
    { code: '611', quartier: 'Besakoa', ville: 'Toliara' },
    { code: '612', quartier: 'Tsimenatse', ville: 'Toliara' },
    { code: '613', quartier: 'Mahavatse', ville: 'Toliara' },
    { code: '614', quartier: 'Andaboly', ville: 'Toliara' },
    { code: '615', quartier: 'Sanfily', ville: 'Toliara' },
    { code: '616', quartier: 'Ankiembe', ville: 'Toliara' },
    { code: '621', quartier: 'Nosy Kely', ville: 'Morondava' },
    { code: '622', quartier: 'Avaradrova', ville: 'Morondava' },
    { code: '631', quartier: 'Bazarikely', ville: 'Taolagnaro' },
    { code: '632', quartier: 'Ampamakiambato', ville: 'Taolagnaro' },
    { code: '641', quartier: 'Centre-ville', ville: 'Ambovombe' }
];

// Personnes fictives ; quartiers et villes réels de la province de Toliara
const ABONNES = [
    { nom: 'TSIRESY', prenom: 'Fenosoa', adresse: 'Lot 12 Besakoa, Toliara', site: '611', tel: '0341203455', usage: 'dom', eau: true },
    { nom: 'MANAMBELONA', prenom: 'Rado', adresse: 'Lot 47 bis Besakoa, Toliara', site: '611', tel: '0329910276', usage: 'dom', eau: true },
    { nom: 'ZAFINDRAVOLA', prenom: 'Liva', adresse: 'Rue de la Mairie, Besakoa, Toliara', site: '611', tel: '0337745120', usage: 'pro', eau: true, activite: 'Épicerie' },
    { nom: 'BOTOMANGA', prenom: 'Tiana', adresse: 'Lot 5 Tsimenatse, Toliara', site: '612', tel: '0384412907', usage: 'dom', eau: false },
    { nom: 'LAHINIRIKO', prenom: 'Faly', adresse: 'Lot 88 Tsimenatse, Toliara', site: '612', tel: '0346658213', usage: 'dom', eau: true },
    { nom: 'TOVONDRAINY', prenom: 'Mbola', adresse: 'Lot 21 Mahavatse, Toliara', site: '613', tel: '0321187634', usage: 'dom', eau: true },
    { nom: 'RAZAFIMAHATRATRA', prenom: 'Andry', adresse: 'Bord de mer, Mahavatse, Toliara', site: '613', tel: '0335520948', usage: 'pro', eau: true, activite: 'Pêcherie' },
    { nom: 'RAMANANTSOA', prenom: 'Vololona', adresse: 'Lot 3 Andaboly, Toliara', site: '614', tel: '0388821356', usage: 'dom', eau: true },
    { nom: 'TSIMIVOLA', prenom: 'Haingo', adresse: 'Lot 64 Sanfily, Toliara', site: '615', tel: '0342276519', usage: 'dom', eau: false },
    { nom: 'RANDRIAMANANA', prenom: 'Jaona', adresse: 'Route de l\'aéroport, Ankiembe, Toliara', site: '616', tel: '0326634802', usage: 'pro', eau: true, activite: 'Boulangerie' },
    { nom: 'VELOMANANA', prenom: 'Noro', adresse: 'Lot 9 Nosy Kely, Morondava', site: '621', tel: '0339045617', usage: 'dom', eau: true },
    { nom: 'MAHATSANGY', prenom: 'Sitraka', adresse: 'Allée des baobabs, Nosy Kely, Morondava', site: '621', tel: '0347712093', usage: 'pro', eau: true, activite: 'Hôtel' },
    { nom: 'REMANJAKA', prenom: 'Patricia', adresse: 'Lot 30 Avaradrova, Morondava', site: '622', tel: '0385538741', usage: 'dom', eau: false },
    { nom: 'RAKOTONIRINA', prenom: 'Eric', adresse: 'Rue du Port, Bazarikely, Taolagnaro', site: '631', tel: '0324490385', usage: 'dom', eau: true },
    { nom: 'ZAFIMAHERY', prenom: 'Lanto', adresse: 'Lot 15 Ampamakiambato, Taolagnaro', site: '632', tel: '0336617240', usage: 'dom', eau: true },
    { nom: 'TSIAVAHANANA', prenom: 'Soa', adresse: 'Marché central, Ambovombe', site: '641', tel: '0348853016', usage: 'pro', eau: false, activite: 'Quincaillerie' }
];

const MARQUES_ELEC = ['Itron', 'Landis+Gyr', 'Hexing'];
const MARQUES_EAU = ['Sensus', 'Itron', 'Zenner'];

// 6 relevés mensuels : mai à octobre 2026
const MOIS_RELEVES = [5, 6, 7, 8, 9, 10];

const email = (a) =>
    `${a.prenom}.${a.nom}`.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z.]/g, '') + (a.usage === 'pro' ? '@entreprise.mg' : '@gmail.com');

// ---------- Étapes ----------

const sauvegarder = async () => {
    const dump = {};
    for (const t of TABLES) {
        dump[t] = (await db.query(`SELECT * FROM ${t} ORDER BY id`)).rows;
    }
    const dir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const horodatage = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const fichier = path.join(dir, `sauvegarde-${horodatage}.json`);
    fs.writeFileSync(fichier, JSON.stringify(dump, null, 2));
    const total = TABLES.map((t) => `${dump[t].length} ${t}`).join(', ');
    console.log(`Sauvegarde : ${fichier} (${total})`);
};

const remplir = async (client) => {
    await client.query(
        'TRUNCATE facture_ligne, facture, releve, compteur, contrat, tarif, abonne, site RESTART IDENTITY'
    );

    const siteIds = {};
    for (const s of SITES) {
        const r = await client.query(
            'INSERT INTO site (code, quartier, ville) VALUES ($1, $2, $3) RETURNING id',
            [s.code, s.quartier, s.ville]
        );
        siteIds[s.code] = r.rows[0].id;
    }

    const tarifIds = {};
    for (const t of TARIFS) {
        const r = await client.query(
            `INSERT INTO tarif (type_tarif, prix_unitaire, date_debut, description)
             VALUES ($1, $2, '2026-01-01', $3) RETURNING id`,
            [t.type_tarif, t.prix, t.description]
        );
        tarifIds[t.cle] = r.rows[0].id;
    }

    let nbCompteurs = 0;
    let nbReleves = 0;
    const releveIds = [];

    for (const [i, a] of ABONNES.entries()) {
        const rang = String(i + 1).padStart(4, '0');

        const abonne = await client.query(
            `INSERT INTO abonne (numero_abonne, nom, prenom, adresse, telephone, email, date_creation, site_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [`AB${rang}`, a.nom, a.prenom, a.adresse, a.tel, email(a), `202${4 + (i % 2)}-0${1 + (i % 9)}-15`, siteIds[a.site]]
        );

        const debut = `202${4 + (i % 2)}-0${1 + (i % 9)}-${String(10 + (i % 15)).padStart(2, '0')}`;
        const contrat = await client.query(
            `INSERT INTO contrat (numero_contrat, type_contrat, date_debut, montant, statut, abonne_id)
             VALUES ($1, $2, $3, $4, 'Actif', $5) RETURNING id`,
            [
                `CTR${rang}`,
                a.usage === 'pro' ? `Professionnel — ${a.activite}` : 'Domestique',
                debut,
                a.usage === 'pro' ? 75000 : 25000, // caution de branchement (Ar)
                abonne.rows[0].id
            ]
        );
        const contratId = contrat.rows[0].id;

        // Compteurs : électricité pour tous, eau pour certains
        const compteurs = [{ type: 'Électrique', tarif: `elec-${a.usage}` }];
        if (a.eau) compteurs.push({ type: 'Eau', tarif: `eau-${a.usage}` });

        for (const c of compteurs) {
            const estEau = c.type === 'Eau';
            const marques = estEau ? MARQUES_EAU : MARQUES_ELEC;
            const compteur = await client.query(
                `INSERT INTO compteur
                    (numero_compteur, type_compteur, marque, date_installation, statut, contrat_id, tarif_id)
                 VALUES ($1, $2, $3, $4, 'Actif', $5, $6) RETURNING id`,
                [
                    `${estEau ? 'EAU' : 'ELE'}-${entre(10000000, 99999999)}`,
                    c.type,
                    marques[entre(0, marques.length - 1)],
                    debut,
                    contratId,
                    tarifIds[c.tarif]
                ]
            );
            nbCompteurs++;

            // Relevés mensuels chaînés : l'ancien index = nouvel index du mois précédent
            let index = estEau ? entre(80, 900) : entre(1500, 28000);
            for (const mois of MOIS_RELEVES) {
                let conso;
                if (estEau) {
                    conso = a.usage === 'pro' ? entre(25, 60) : entre(6, 22);
                } else {
                    conso = a.usage === 'pro' ? entre(380, 950) : entre(75, 260);
                }
                const date = `2026-${String(mois).padStart(2, '0')}-${entre(24, 28)}`;
                const r = await client.query(
                    `INSERT INTO releve
                        (contrat_id, compteur_id, date_releve, ancien_index, nouvel_index, consommation)
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                    [contratId, compteur.rows[0].id, date, index, index + conso, conso]
                );
                releveIds.push({ id: r.rows[0].id, date, mois });
                index += conso;
                nbReleves++;
            }
        }
    }

    // Factures mensuelles (eau + électricité d'un contrat) générées par le service,
    // puis datées et réglées comme dans la réalité
    for (const r of releveIds) {
        await genererFacture(client, r.id);
    }

    const factures = (await client.query(
        `SELECT f.id, f.periode, max(r.date_releve)::text AS dernier_releve
         FROM facture f
         JOIN facture_ligne fl ON fl.facture_id = f.id
         JOIN releve r ON r.id = fl.releve_id
         GROUP BY f.id
         ORDER BY f.id`
    )).rows;

    let payees = 0;
    for (const f of factures) {
        const mois = Number(f.periode.slice(5, 7));
        const emission = plusJours(f.dernier_releve, 3);
        const echeance = plusJours(emission, 15);

        // Mai à août : presque toutes payées ; septembre : la plupart ; octobre : quelques-unes
        const chance = mois <= 8 ? 0.93 : mois === 9 ? 0.7 : 0.25;
        const paye = alea() < chance;
        // Paiement 2 à 14 jours après l'émission, jamais dans le futur
        const aujourdhui = iso(new Date());
        const paiementPrevu = plusJours(emission, entre(2, 14));
        const paiement = paye ? (paiementPrevu > aujourdhui ? aujourdhui : paiementPrevu) : null;

        await client.query(
            `UPDATE facture
             SET date_emission = $2, date_echeance = $3, statut = $4, date_paiement = $5
             WHERE id = $1`,
            [f.id, emission, echeance, paye ? STATUT_PAYEE : 'impayee', paiement]
        );
        if (paye) payees++;
    }

    console.log(
        `Insérés : ${TARIFS.length} tarifs, ${ABONNES.length} abonnés, ${ABONNES.length} contrats, ` +
        `${nbCompteurs} compteurs, ${nbReleves} relevés, ${factures.length} factures mensuelles ` +
        `(${payees} payées, ${factures.length - payees} impayées)`
    );
};

(async () => {
    const client = await db.connect();
    try {
        await initSites();
        await createFactureTables();
        await sauvegarder();

        await client.query('BEGIN');
        await remplir(client);
        await client.query('COMMIT');
        console.log('Données remplacées avec succès.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Échec, aucune donnée modifiée :', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await db.end();
    }
})();
