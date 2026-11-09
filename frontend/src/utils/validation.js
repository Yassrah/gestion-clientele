// Règles de validation partagées (miroir de backend/utils/validation.js)

// Téléphone malgache : 0 + 9 chiffres ou +261 + 9 chiffres (espaces, points, tirets ignorés)
const TELEPHONE_REGEX = /^(?:\+261|0)\d{9}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function telephoneValide(value) {
  if (!value || !value.trim()) return true
  return TELEPHONE_REGEX.test(value.replace(/[\s.\-()]/g, ''))
}

export function emailValide(value) {
  if (!value || !value.trim()) return true
  return EMAIL_REGEX.test(value.trim())
}

// Erreurs par champ pour le téléphone et l'email d'un abonné ({} si tout est valide)
export function erreursContact({ telephone, email }) {
  const erreurs = {}
  if (!telephoneValide(telephone)) {
    erreurs.telephone = 'Numéro invalide (ex : 0325611411 ou +261325611411)'
  }
  if (!emailValide(email)) {
    erreurs.email = 'Adresse email invalide (ex : nom@domaine.com)'
  }
  return erreurs
}
