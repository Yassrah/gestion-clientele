const express = require('express');
const app = express();

require('./config/db');

app.use(express.json());

app.use('/api/abonne', require('./route/abonne.route'));
app.use('/api/contrat', require('./route/contrat.route'));
app.use('/api/releve', require('./route/releve.route'));
app.use('/api/compteur', require('./route/compteur.route'));
app.use('/api/tarif', require('./route/tarif.route'));
app.get('/', (req, res) => {
    res.send('API Gestion Clientele');
});

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Serveur sur le port ${PORT}`);
});
