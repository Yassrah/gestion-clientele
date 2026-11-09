const db = require('../config/db');

// Valeurs autorisées (listes de choix des formulaires)
const STATUTS_CONTRAT = ['Actif', 'Suspendu', 'Résilié'];
const STATUTS_COMPTEUR = ['Actif', 'Hors service'];

// Un contrat suspendu/résilié ou un compteur hors service n'accepte plus de nouveaux relevés
const contratActif = (statut) => !statut || statut === 'Actif';
const compteurActif = (statut) => !statut || statut === 'Actif';

// Nombre de contrats / compteurs / relevés / factures payées rattachés à un enregistrement
const REQUETES = {
    abonne: `
        SELECT
            (SELECT count(*) FROM contrat WHERE abonne_id = $1) AS contrats,
            (SELECT count(*) FROM compteur cp JOIN contrat c ON c.id = cp.contrat_id WHERE c.abonne_id = $1) AS compteurs,
            (SELECT count(*) FROM releve r JOIN contrat c ON c.id = r.contrat_id WHERE c.abonne_id = $1) AS releves,
            (SELECT count(DISTINCT f.id) FROM facture f JOIN facture_ligne fl ON fl.facture_id = f.id JOIN releve r ON r.id = fl.releve_id JOIN contrat c ON c.id = r.contrat_id
             WHERE c.abonne_id = $1 AND f.statut = 'payee') AS payees`,
    contrat: `
        SELECT
            0 AS contrats,
            (SELECT count(*) FROM compteur WHERE contrat_id = $1) AS compteurs,
            (SELECT count(*) FROM releve WHERE contrat_id = $1) AS releves,
            (SELECT count(DISTINCT f.id) FROM facture f JOIN facture_ligne fl ON fl.facture_id = f.id JOIN releve r ON r.id = fl.releve_id
             WHERE r.contrat_id = $1 AND f.statut = 'payee') AS payees`,
    compteur: `
        SELECT
            0 AS contrats,
            0 AS compteurs,
            (SELECT count(*) FROM releve WHERE compteur_id = $1) AS releves,
            (SELECT count(DISTINCT f.id) FROM facture f JOIN facture_ligne fl ON fl.facture_id = f.id JOIN releve r ON r.id = fl.releve_id
             WHERE r.compteur_id = $1 AND f.statut = 'payee') AS payees`
};

const compterDependances = async (table, id) => {
    const row = (await db.query(REQUETES[table], [id])).rows[0];
    return {
        contrats: Number(row.contrats),
        compteurs: Number(row.compteurs),
        releves: Number(row.releves),
        payees: Number(row.payees)
    };
};

// Message de refus si l'enregistrement a des compteurs ou des relevés, sinon null.
// (Les supprimer effacerait l'historique de consommation et des factures, parfois payées.)
const refusSuppression = (libelle, d, conseil) => {
    if (d.compteurs === 0 && d.releves === 0) return null;
    const parts = [];
    if (d.contrats) parts.push(`${d.contrats} contrat(s)`);
    if (d.compteurs) parts.push(`${d.compteurs} compteur(s)`);
    if (d.releves) parts.push(`${d.releves} relevé(s)`);
    const payees = d.payees ? ` dont ${d.payees} facture(s) payée(s)` : '';
    return `Impossible de supprimer ${libelle} : il a ${parts.join(', ')}${payees}. ${conseil}`;
};

module.exports = {
    STATUTS_CONTRAT,
    STATUTS_COMPTEUR,
    contratActif,
    compteurActif,
    compterDependances,
    refusSuppression
};
