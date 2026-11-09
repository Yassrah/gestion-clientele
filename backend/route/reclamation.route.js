const express = require('express');
const router = express.Router();

const ctrl = require('../controller/reclamation.controller');
const { exigerAdmin } = require('../middleware/role.middleware');

router.get('/', ctrl.getAllReclamation);
// Pastille du menu (déclarée avant /:id)
router.get('/compteur', ctrl.compterOuvertes);
router.get('/:id', ctrl.getReclamation);
router.post('/', ctrl.createReclamation);

// Actions de suivi
router.put('/:id/prendre', ctrl.prendreEnCharge);
router.post('/:id/controle', ctrl.demanderControle);
router.put('/:id/cloturer', ctrl.cloturer);
router.post('/:id/suivi', ctrl.ajouterNote);

// Suppression réservée aux administrateurs
router.delete('/:id', exigerAdmin, ctrl.deleteReclamation);

module.exports = router;
