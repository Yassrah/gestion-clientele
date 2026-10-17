const express = require('express');
const router = express.Router();

const ctrl = require('../controller/abonne.controller');

// GET - récupérer tous les abonnés
router.get('/', ctrl.getAllAbonne);

// POST - ajouter un abonné
router.post('/', ctrl.createAbonne);

// PUT - modifier un abonné
router.put('/:id', ctrl.updateAbonne);

// DELETE - supprimer un abonné
router.delete('/:id', ctrl.deleteAbonne);

module.exports = router;