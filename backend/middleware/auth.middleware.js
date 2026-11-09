const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/auth');

// Vérifie le jeton "Authorization: Bearer <token>" et ajoute req.user
const verifyToken = (req, res, next) => {
    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');

    if (type !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Authentification requise' });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Session expirée ou invalide' });
    }
};

module.exports = verifyToken;
