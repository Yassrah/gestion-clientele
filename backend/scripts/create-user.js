// Crée (ou met à jour) un utilisateur de l'application.
// Usage : npm run create-user -- <username> <motdepasse> [nom] [admin|agent]
//   admin : tous les droits ; agent (par défaut) : saisie et encaissement, sans suppression
//   ni gestion des tarifs ni annulation de paiement.
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { initAuthTable, initRoles } = require('../config/init-db');

const [username, password, nom, role = 'agent'] = process.argv.slice(2);

if (!username || !password || !['admin', 'agent'].includes(role)) {
    console.error('Usage : npm run create-user -- <username> <motdepasse> [nom] [admin|agent]');
    process.exit(1);
}

(async () => {
    try {
        await initAuthTable();
        await initRoles();

        const hash = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO utilisateur (username, password_hash, nom, role)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (username)
             DO UPDATE SET password_hash = EXCLUDED.password_hash, nom = EXCLUDED.nom, role = EXCLUDED.role
             RETURNING id, username, nom, role`,
            [username, hash, nom || username, role]
        );

        console.log('Utilisateur enregistré :', result.rows[0]);
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
})();
