const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'formation_db',
    password: '0000',
    port: 5432
});

pool.connect()
    .then(() => console.log('Connexion PostgreSQL réussie'))
    .catch(err => console.error(err));

module.exports = pool;