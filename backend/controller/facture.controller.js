const db = require('../config/db');
const {
    STATUT_IMPAYEE,
    STATUT_PAYEE,
    genererFacturesManquantes,
    detailFacture
} = require('../service/facture.service');

// GET toutes les factures mensuelles (filtre optionnel ?statut=payee|impayee)
const getAllFacture = async (req, res) => {
    try {
        const { statut } = req.query;
        const params = [];
        let where = '';
        if (statut) {
            params.push(statut);
            where = 'WHERE f.statut = $1';
        }

        const result = await db.query(
            `SELECT
                f.*,
                c.numero_contrat,
                a.numero_abonne,
                a.nom,
                a.prenom,
                s.code AS site_code,
                s.quartier AS site_quartier,
                COALESCE(sum(fl.total) FILTER (WHERE fl.type = 'electricite'), 0) AS total_electricite,
                COALESCE(sum(fl.total) FILTER (WHERE fl.type = 'eau'), 0) AS total_eau,
                COALESCE(sum(fl.consommation) FILTER (WHERE fl.type = 'electricite'), 0) AS conso_electricite,
                COALESCE(sum(fl.consommation) FILTER (WHERE fl.type = 'eau'), 0) AS conso_eau,
                min(fl.releve_id) AS releve_id
             FROM facture f
             JOIN contrat c ON c.id = f.contrat_id
             JOIN abonne a ON a.id = c.abonne_id
             LEFT JOIN site s ON s.id = a.site_id
             LEFT JOIN facture_ligne fl ON fl.facture_id = f.id
             ${where}
             GROUP BY f.id, c.numero_contrat, a.numero_abonne, a.nom, a.prenom, s.code, s.quartier
             ORDER BY f.periode DESC, a.nom, f.id DESC`,
            params
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la récupération des factures'
        });
    }
};

// GET facture complète pour l'impression (électricité + eau)
const getImpressionFacture = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Identifiant de facture invalide' });
        }

        const facture = await detailFacture(id);
        if (!facture) {
            return res.status(404).json({ message: 'Facture introuvable' });
        }
        res.status(200).json(facture);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la préparation de la facture',
            error: error.message
        });
    }
};

// PUT enregistrer (ou annuler) le paiement d'une facture.
// L'annulation d'un paiement est réservée aux administrateurs.
const putStatutFacture = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Identifiant de facture invalide' });
        }

        const { statut } = req.body;
        if (![STATUT_PAYEE, STATUT_IMPAYEE].includes(statut)) {
            return res.status(400).json({
                message: `Statut invalide (attendu : ${STATUT_PAYEE} ou ${STATUT_IMPAYEE})`
            });
        }
        if (statut === STATUT_IMPAYEE) {
            const role = (await db.query('SELECT role FROM utilisateur WHERE id = $1', [req.user.id])).rows[0]?.role;
            if (role !== 'admin') {
                return res.status(403).json({
                    message: 'Seul un administrateur peut annuler un paiement'
                });
            }
        }

        const result = await db.query(
            `UPDATE facture
             SET statut = $1::varchar,
                 date_paiement = CASE WHEN $1::varchar = '${STATUT_PAYEE}' THEN CURRENT_DATE ELSE NULL END
             WHERE id = $2
             RETURNING *`,
            [statut, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Facture introuvable' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la mise à jour de la facture',
            error: error.message
        });
    }
};

// POST facturer les relevés qui n'ont pas encore de facture
const genererFactures = async (req, res) => {
    try {
        const generes = await genererFacturesManquantes();
        res.status(200).json({
            generes,
            message: generes > 0
                ? `${generes} relevé(s) ajouté(s) aux factures`
                : 'Aucun relevé à facturer'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la génération des factures',
            error: error.message
        });
    }
};

module.exports = {
    getAllFacture,
    getImpressionFacture,
    putStatutFacture,
    genererFactures
};
