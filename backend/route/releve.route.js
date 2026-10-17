const express = require('express');
const router = express.Router();

const ctrl = require('../controller/releve.controller');

// Récupérer tous les relevés
router.get('/', ctrl.getAllReleve);

// Créer un relevé
router.post('/', ctrl.createReleve);

router.put('/:id', ctrl.putReleve);

router.delete('/:id', ctrl.deleteReleve);

router.get('/abonne/:nom', ctrl.getReleveByAbonne);

module.exports = router;
