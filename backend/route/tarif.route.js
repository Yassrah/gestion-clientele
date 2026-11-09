const express = require('express');
const router = express.Router();

const ctrl = require('../controller/tarif.controller');
const { exigerAdmin } = require('../middleware/role.middleware');

router.get('/', ctrl.getAllTarif);
// Gestion des tarifs réservée aux administrateurs
router.post('/', exigerAdmin, ctrl.createTarif);
router.put('/:id', exigerAdmin, ctrl.putTarif);
router.delete('/:id', exigerAdmin, ctrl.deleteTarif);

module.exports = router;
