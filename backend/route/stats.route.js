const express = require('express');
const router = express.Router();

const ctrl = require('../controller/stats.controller');

// Statistiques du tableau de bord (filtres : annee, mois, service)
router.get('/', ctrl.getStats);

module.exports = router;
