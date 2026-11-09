// Réclamations de démonstration (cas repris de la maquette « Réclamations », abonnés de Toliara).
// Utilisé par seed-demo.js ; chaque entrée référence un abonné par son numéro.
const RECLAMATIONS = [
    {
        abonne: 'AB0001', type: 'Contestation de frais', canal: 'Guichet Toliara', statut: 'Ouverte', date: '2026-11-03',
        description: 'L\'abonnée conteste la ligne « Autres frais » de 1 000 Ar (frais compteur) sur la facture d\'octobre et demande le détail de cette somme.',
        suivi: [['2026-11-03 09:15', 'Réclamation enregistrée au guichet.']]
    },
    {
        abonne: 'AB0013', type: 'Facture estimée contestée', canal: 'Téléphone 3547', statut: 'En cours', date: '2026-10-30', prise: true,
        description: 'Facture d\'octobre jugée trop élevée alors que le logement était inoccupé trois semaines. Le compteur est derrière un portail fermé lors du passage du releveur.',
        suivi: [['2026-10-30 10:40', 'Appel reçu au 3547.'], ['2026-10-31 08:20', 'Prise en charge par l\'agence de Morondava.']]
    },
    {
        abonne: 'AB0012', type: 'Surconsommation signalée', canal: 'E-mail service-client', statut: 'En cours', date: '2026-10-28', prise: true,
        description: 'Consommation électrique de l\'hôtel environ deux fois supérieure à la moyenne des mois précédents. Le gérant suspecte une dérive du compteur ou une erreur de lecture.',
        suivi: [['2026-10-28 14:05', 'E-mail reçu.'], ['2026-10-29 09:30', 'Relevé de contrôle demandé au releveur de Morondava.']]
    },
    {
        abonne: 'AB0005', type: 'Fuite avant compteur', canal: 'Guichet Toliara', statut: 'Ouverte', date: '2026-10-24',
        description: 'Fuite signalée sur le branchement d\'eau, côté réseau, avant le compteur, devant le lot 88 à Tsimenatse.',
        suivi: [['2026-10-24 11:00', 'Réclamation enregistrée au guichet.']]
    },
    {
        abonne: 'AB0006', type: 'Auto-relevé non pris en compte', canal: 'Mobile money', statut: 'Résolue', date: '2026-10-15', prise: true, resolution: '2026-10-18',
        description: 'Index transmis par mobile money le 26/09 non reporté sur la facture de septembre.',
        suivi: [['2026-10-15 16:10', 'Réclamation reçue.'], ['2026-10-18 10:00', 'Index vérifié, facture rectifiée et abonné informé par SMS.']]
    }
];

// Insère les réclamations ; userId signe les prises en charge et le suivi
const insererReclamations = async (client, userId) => {
    let n = 0;
    for (const r of RECLAMATIONS) {
        const abonne = (await client.query('SELECT id FROM abonne WHERE numero_abonne = $1', [r.abonne])).rows[0];
        if (!abonne) continue;
        const { id } = (await client.query(
            `INSERT INTO reclamation (abonne_id, type, description, canal, statut, assignee_id, date_reception, date_resolution)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [abonne.id, r.type, r.description, r.canal, r.statut, r.prise ? userId : null, r.date, r.resolution || null]
        )).rows[0];
        for (const [date, texte] of r.suivi) {
            await client.query(
                'INSERT INTO reclamation_suivi (reclamation_id, date_suivi, texte, utilisateur_id) VALUES ($1, $2, $3, $4)',
                [id, date, texte, userId]
            );
        }
        n++;
    }
    return n;
};

module.exports = { RECLAMATIONS, insererReclamations };
