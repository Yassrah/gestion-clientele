const path = require('path');

// Charge backend/.env (ignoré par git) dans process.env, s'il existe.
// Les variables déjà définies dans l'environnement restent prioritaires.
try {
    process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

// Renvoie une variable obligatoire ou arrête avec un message explicite
const requis = (nom) => {
    const valeur = process.env[nom];
    if (valeur === undefined || valeur === '') {
        throw new Error(
            `Variable d'environnement ${nom} manquante : copiez backend/.env.example en backend/.env et complétez-le`
        );
    }
    return valeur;
};

module.exports = { requis };
