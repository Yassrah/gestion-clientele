const express = require('express');
const router = express.Router();

const ctrl = require('../controller/releve.controller');
const { exigerAdmin } = require('../middleware/role.middleware');

// Récupérer tous les relevés
router.get('/', ctrl.getAllReleve);

// Facture imprimable d'un relevé
router.get('/facture/:id', ctrl.getFactureReleve);

// Créer un relevé
router.post('/', ctrl.createReleve);

router.put('/:id', ctrl.putReleve);

// Suppression réservée aux administrateurs
router.delete('/:id', exigerAdmin, ctrl.deleteReleve);

router.get('/abonne/:nom', ctrl.getReleveByAbonne);

module.exports = router;
