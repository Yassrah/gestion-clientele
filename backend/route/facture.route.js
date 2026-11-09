const express = require('express');
const router = express.Router();

const ctrl = require('../controller/facture.controller');

router.get('/', ctrl.getAllFacture);

// Facturer les relevés qui n'ont pas encore de facture
router.post('/generer', ctrl.genererFactures);

// Facture complète pour l'impression
router.get('/:id/impression', ctrl.getImpressionFacture);

// Enregistrer / annuler un paiement (annulation : admin)
router.put('/:id/statut', ctrl.putStatutFacture);

module.exports = router;
