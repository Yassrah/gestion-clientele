const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth');

// ---------- Limitation des tentatives de connexion ----------
// 5 échecs en 15 minutes pour un même couple (adresse IP, identifiant) bloquent ce couple
// pendant 15 minutes. Compteurs en mémoire : remis à zéro au redémarrage du serveur.
const MAX_ECHECS = 5;
const FENETRE_MS = 15 * 60 * 1000;
const echecs = new Map(); // clé → { nombre, debut, bloqueJusqua }

const cle = (req, username) => `${req.ip}|${String(username).toLowerCase()}`;

const minutesRestantes = (k) => {
    const e = echecs.get(k);
    if (!e || !e.bloqueJusqua) return 0;
    const reste = e.bloqueJusqua - Date.now();
    if (reste <= 0) {
        echecs.delete(k);
        return 0;
    }
    return Math.ceil(reste / 60000);
};

const noterEchec = (k) => {
    const maintenant = Date.now();
    let e = echecs.get(k);
    if (!e || maintenant - e.debut > FENETRE_MS) e = { nombre: 0, debut: maintenant };
    e.nombre += 1;
    if (e.nombre >= MAX_ECHECS) e.bloqueJusqua = maintenant + FENETRE_MS;
    echecs.set(k, e);
    return MAX_ECHECS - e.nombre;
};

// POST connexion
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Nom d'utilisateur et mot de passe obligatoires"
            });
        }

        const k = cle(req, username);
        const bloque = minutesRestantes(k);
        if (bloque > 0) {
            return res.status(429).json({
                message: `Trop de tentatives échouées. Réessayez dans ${bloque} minute(s).`
            });
        }

        const result = await db.query(
            'SELECT * FROM utilisateur WHERE username = $1',
            [username]
        );
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            const restantes = noterEchec(k);
            return res.status(401).json({
                message: restantes > 0
                    ? `Nom d'utilisateur ou mot de passe incorrect (${restantes} essai(s) restant(s))`
                    : 'Trop de tentatives échouées. Réessayez dans 15 minute(s).'
            });
        }

        echecs.delete(k);
        const payload = { id: user.id, username: user.username, nom: user.nom, role: user.role };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.status(200).json({ token, user: payload });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erreur lors de la connexion'
        });
    }
};

// GET utilisateur connecté (rôle relu en base)
const me = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, nom, role FROM utilisateur WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Compte introuvable' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération du compte' });
    }
};

module.exports = {
    login,
    me
};
