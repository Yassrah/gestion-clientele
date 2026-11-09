const fs = require('fs');
require('./env');
const path = require('path');
const crypto = require('crypto');

// Configuration de l'authentification JWT.
// Clé de signature : variable d'environnement JWT_SECRET, sinon une clé aléatoire
// générée au premier démarrage et conservée dans backend/.jwt-secret (ignoré par git).
// Aucune clé n'est écrite dans le code source.
const SECRET_FILE = path.join(__dirname, '..', '.jwt-secret');

const loadSecret = () => {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

    if (fs.existsSync(SECRET_FILE)) {
        return fs.readFileSync(SECRET_FILE, 'utf8').trim();
    }

    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
    console.log('Clé JWT générée dans backend/.jwt-secret');
    return secret;
};

module.exports = {
    JWT_SECRET: loadSecret(),
    JWT_EXPIRES_IN: '8h'
};
