const { Pool } = require('pg');
const { requis } = require('./env');

// Connexion définie dans backend/.env (voir .env.example) — aucun identifiant dans le code
const pool = new Pool({
    user: requis('DB_USER'),
    host: process.env.DB_HOST || 'localhost',
    database: requis('DB_NAME'),
    password: requis('DB_PASSWORD'),
    port: Number(process.env.DB_PORT || 5432)
});

pool.connect()
    .then(client => {
        // Libère la connexion de test pour ne pas bloquer le pool
        client.release();
        console.log('Connexion PostgreSQL réussie');
    })
    .catch(err => console.error(err));

module.exports = pool;