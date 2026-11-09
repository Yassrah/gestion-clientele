const express = require('express');
const router = express.Router();

const ctrl = require('../controller/contrat.controller');
const { exigerAdmin } = require('../middleware/role.middleware');

router.get('/', ctrl.getAllContrat);
router.post('/', ctrl.createContrat);
router.put('/:id', ctrl.updateContrat);
// Suppression réservée aux administrateurs
router.delete('/:id', exigerAdmin, ctrl.deleteContrat);

module.exports = router;