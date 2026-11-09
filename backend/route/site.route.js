const express = require('express');
const router = express.Router();

const ctrl = require('../controller/site.controller');
const { exigerAdmin } = require('../middleware/role.middleware');

router.get('/', ctrl.getAllSite);

// Gestion des sites réservée aux administrateurs
router.post('/', exigerAdmin, ctrl.createSite);
// Import Excel (déclaré avant les routes /:id)
router.post('/import', exigerAdmin, ctrl.importSites);
router.put('/:id', exigerAdmin, ctrl.putSite);
router.delete('/:id', exigerAdmin, ctrl.deleteSite);

module.exports = router;
