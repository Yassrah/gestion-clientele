const db = require('../config/db');

// Réserve une route aux administrateurs (à placer après verifyToken).
// Le rôle est relu en base : un changement de rôle s'applique sans attendre l'expiration du jeton.
const exigerAdmin = async (req, res, next) => {
    try {
        const result = await db.query('SELECT role FROM utilisateur WHERE id = $1', [req.user.id]);
        if (result.rows[0]?.role !== 'admin') {
            return res.status(403).json({
                message: 'Action réservée aux administrateurs'
            });
        }
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la vérification des droits' });
    }
};

module.exports = { exigerAdmin };
