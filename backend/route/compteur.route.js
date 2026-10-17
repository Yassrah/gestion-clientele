const express = require('express');
const router = express.Router();

const ctrl = require('../controller/compteur.controller');

// GET tous les compteurs
router.get('/', ctrl.getAllCompteur);

// POST créer un compteur
router.post('/', ctrl.createCompteur);

router.put('/:id', ctrl.putCompteur);

router.delete('/:id', ctrl.deleteCompteur);

module.exports = router;
