const express = require('express');
const router = express.Router();

const ctrl = require('../controller/compteur.controller');
const { exigerAdmin } = require('../middleware/role.middleware');

// GET tous les compteurs
router.get('/', ctrl.getAllCompteur);

// POST créer un compteur
router.post('/', ctrl.createCompteur);

router.put('/:id', ctrl.putCompteur);

// Suppression réservée aux administrateurs
router.delete('/:id', exigerAdmin, ctrl.deleteCompteur);

module.exports = router;
