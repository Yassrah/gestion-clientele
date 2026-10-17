const express = require('express');
const router = express.Router();

const ctrl = require('../controller/tarif.controller');

router.get('/', ctrl.getAllTarif);
router.post('/', ctrl.createTarif);
router.put('/:id', ctrl.putTarif);
router.delete('/:id', ctrl.deleteTarif);

module.exports = router;
