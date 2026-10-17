const express = require('express');
const router = express.Router();

const ctrl = require('../controller/contrat.controller');

router.get('/', ctrl.getAllContrat);
router.post('/', ctrl.createContrat);
router.put('/:id', ctrl.updateContrat);
router.delete('/:id', ctrl.deleteContrat);

module.exports = router;