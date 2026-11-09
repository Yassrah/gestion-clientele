const db = require('../config/db');

// ---------- Statistiques du tableau de bord ----------
// GET /api/stats?annee=2026&mois=10&service=eau|electricite
//   annee   : année des graphiques mensuels (par défaut : la plus récente ayant des relevés)
//   mois    : 1-12, restreint les cartes « période » (relevés, nouveaux abonnés) à ce mois
//   service : restreint relevés et consommations à l'eau ou à l'électricité
// Le type de service d'un compteur se déduit de type_compteur (« Eau » → eau, sinon électricité).

const SERVICE_SQL = "CASE WHEN cp.type_compteur ILIKE '%eau%' THEN 'eau' ELSE 'electricite' END";

const getStats = async (req, res) => {
    try {
        const annees = (await db.query(
            `SELECT DISTINCT annee FROM (
                SELECT EXTRACT(YEAR FROM date_releve)::int AS annee FROM releve
                UNION
                SELECT EXTRACT(YEAR FROM date_creation)::int FROM abonne WHERE date_creation IS NOT NULL
             ) t ORDER BY annee DESC`
        )).rows.map((r) => r.annee);

        const anneeReleves = (await db.query(
            'SELECT EXTRACT(YEAR FROM max(date_releve))::int AS a FROM releve'
        )).rows[0].a;
        const annee = Number(req.query.annee) || anneeReleves || new Date().getFullYear();

        const mois = Number(req.query.mois);
        if (req.query.mois && !(Number.isInteger(mois) && mois >= 1 && mois <= 12)) {
            return res.status(400).json({ message: 'Mois invalide (1 à 12)' });
        }
        const service = ['eau', 'electricite'].includes(req.query.service) ? req.query.service : null;

        // Filtres communs : $1 = année, $2 = mois (ou null), $3 = service (ou null)
        const params = [annee, mois || null, service];
        const periodeReleve = `EXTRACT(YEAR FROM r.date_releve) = $1
            AND ($2::int IS NULL OR EXTRACT(MONTH FROM r.date_releve) = $2)
            AND ($3::text IS NULL OR ${SERVICE_SQL} = $3)`;

        const [cartes, parMois, nouveaux, parType, parStatut, compteurs] = await Promise.all([
            db.query(
                `SELECT
                    (SELECT count(*)::int FROM abonne) AS abonnes,
                    (SELECT count(*)::int FROM abonne
                     WHERE EXTRACT(YEAR FROM date_creation) = $1
                       AND ($2::int IS NULL OR EXTRACT(MONTH FROM date_creation) = $2)) AS nouveaux_abonnes,
                    (SELECT count(*)::int FROM contrat) AS contrats,
                    (SELECT count(*)::int FROM contrat WHERE statut = 'Actif') AS contrats_actifs,
                    (SELECT count(*)::int FROM compteur) AS compteurs,
                    (SELECT count(*)::int FROM releve r LEFT JOIN compteur cp ON cp.id = r.compteur_id
                     WHERE ${periodeReleve}) AS releves`,
                params
            ),
            // Relevés et consommations par mois et par service, pour l'année
            db.query(
                `SELECT EXTRACT(MONTH FROM r.date_releve)::int AS mois,
                        ${SERVICE_SQL} AS service,
                        count(*)::int AS releves,
                        COALESCE(sum(r.consommation), 0)::float AS consommation
                 FROM releve r
                 LEFT JOIN compteur cp ON cp.id = r.compteur_id
                 WHERE EXTRACT(YEAR FROM r.date_releve) = $1
                   AND ($2::text IS NULL OR ${SERVICE_SQL} = $2)
                 GROUP BY 1, 2`,
                [annee, service]
            ),
            db.query(
                `SELECT EXTRACT(MONTH FROM date_creation)::int AS mois, count(*)::int AS n
                 FROM abonne WHERE EXTRACT(YEAR FROM date_creation) = $1
                 GROUP BY 1`,
                [annee]
            ),
            db.query(
                `SELECT COALESCE(NULLIF(type_contrat, ''), 'Non défini') AS type, count(*)::int AS n
                 FROM contrat GROUP BY 1 ORDER BY n DESC, type`
            ),
            db.query(
                `SELECT COALESCE(statut, 'Actif') AS statut, count(*)::int AS n
                 FROM contrat GROUP BY 1`
            ),
            db.query(
                `SELECT ${SERVICE_SQL} AS service, count(*)::int AS n
                 FROM compteur cp GROUP BY 1`
            )
        ]);

        // Séries mensuelles complètes (12 mois, 0 quand il n'y a rien)
        const douze = () => Array.from({ length: 12 }, () => 0);
        const releves = { eau: douze(), electricite: douze() };
        const consommation = { eau: douze(), electricite: douze() };
        for (const l of parMois.rows) {
            releves[l.service][l.mois - 1] = l.releves;
            consommation[l.service][l.mois - 1] = Math.round(l.consommation * 100) / 100;
        }
        const nouveauxParMois = douze();
        for (const l of nouveaux.rows) nouveauxParMois[l.mois - 1] = l.n;

        const statuts = ['Actif', 'Suspendu', 'Résilié'].map((s) => ({
            statut: s,
            n: parStatut.rows.find((r) => r.statut === s)?.n || 0
        }));
        const nbCompteurs = (s) => compteurs.rows.find((r) => r.service === s)?.n || 0;

        res.status(200).json({
            filtres: { annee, mois: mois || null, service, annees },
            cartes: cartes.rows[0],
            releves_par_mois: releves,
            consommation_par_mois: consommation,
            nouveaux_abonnes_par_mois: nouveauxParMois,
            contrats_par_type: parType.rows,
            contrats_par_statut: statuts,
            compteurs_par_service: { eau: nbCompteurs('eau'), electricite: nbCompteurs('electricite') }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du calcul des statistiques', error: error.message });
    }
};

module.exports = { getStats };
