const express = require('express');
const router = express.Router();

const ctrl = require('../controller/auth.controller');
const verifyToken = require('../middleware/auth.middleware');

// Connexion (publique)
router.post('/login', ctrl.login);

// Utilisateur connecté
router.get('/me', verifyToken, ctrl.me);

module.exports = router;
