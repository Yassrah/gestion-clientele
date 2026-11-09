const express = require('express');
const app = express();

require('./config/db');
const { initDb } = require('./config/init-db');

const verifyToken = require('./middleware/auth.middleware');

// 1 Mo : imports en masse (ex. sites depuis un fichier Excel)
app.use(express.json({ limit: '1mb' }));

// Authentification (publique)
app.use('/api/auth', require('./route/auth.route'));

// Routes protégées : jeton JWT obligatoire
app.use('/api/abonne', verifyToken, require('./route/abonne.route'));
app.use('/api/contrat', verifyToken, require('./route/contrat.route'));
app.use('/api/releve', verifyToken, require('./route/releve.route'));
app.use('/api/compteur', verifyToken, require('./route/compteur.route'));
app.use('/api/tarif', verifyToken, require('./route/tarif.route'));
app.use('/api/facture', verifyToken, require('./route/facture.route'));
app.use('/api/site', verifyToken, require('./route/site.route'));
app.use('/api/stats', verifyToken, require('./route/stats.route'));
app.use('/api/reclamation', verifyToken, require('./route/reclamation.route'));
app.get('/', (req, res) => {
    res.send('API Gestion Clientele');
});

const PORT = Number(process.env.PORT) || 5000;

// Le serveur n'écoute qu'une fois la base initialisée (table utilisateur, contraintes)
initDb()
    .then(() => {
        // Express 5 passe l'erreur d'écoute (ex. port occupé) au callback
        app.listen(PORT, (err) => {
            if (err) {
                console.error(err.code === 'EADDRINUSE'
                    ? `Le port ${PORT} est déjà utilisé (un ancien serveur tourne encore ?). ` +
                      `Arrêtez-le : netstat -ano | findstr :${PORT} puis taskkill /PID <pid> /F`
                    : `Démarrage impossible : ${err.message}`);
                process.exit(1);
            }
            console.log(`Serveur sur le port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('Initialisation de la base impossible, arrêt du serveur :', err.message);
        process.exit(1);
    });
