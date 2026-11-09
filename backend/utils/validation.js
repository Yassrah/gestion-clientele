// Règles de validation partagées (miroir de frontend/src/utils/validation.js)

// Téléphone malgache : 0 + 9 chiffres ou +261 + 9 chiffres (espaces, points, tirets ignorés)
const TELEPHONE_REGEX = /^(?:\+261|0)\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Renvoie le numéro sans séparateurs, '' si vide, ou null s'il est invalide
const normaliserTelephone = (value) => {
    if (value == null || String(value).trim() === '') return '';
    const tel = String(value).replace(/[\s.\-()]/g, '');
    return TELEPHONE_REGEX.test(tel) ? tel : null;
};

// Renvoie l'email nettoyé, '' si vide, ou null s'il est invalide
const normaliserEmail = (value) => {
    if (value == null || String(value).trim() === '') return '';
    const email = String(value).trim().toLowerCase();
    return EMAIL_REGEX.test(email) ? email : null;
};

module.exports = {
    normaliserTelephone,
    normaliserEmail
};
