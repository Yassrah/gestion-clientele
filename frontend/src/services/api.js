// Service API centralisé pour communiquer avec le backend Express.
// Grâce au proxy Vite, les appels vers /api sont redirigés vers http://localhost:5000

const BASE = '/api'

// Session (jeton JWT + utilisateur) :
//   « Se souvenir de moi » coché   → localStorage (survit à la fermeture du navigateur)
//   « Se souvenir de moi » décoché → sessionStorage (effacée à la fermeture du navigateur)
const TOKEN_KEY = 'gc_token'
const USER_KEY = 'gc_user'

// Stockage qui contient la session en cours (localStorage par défaut)
const stockageActuel = () => (sessionStorage.getItem(TOKEN_KEY) ? sessionStorage : localStorage)

export const session = {
  getToken: () => stockageActuel().getItem(TOKEN_KEY),
  getUser: () => {
    try {
      return JSON.parse(stockageActuel().getItem(USER_KEY))
    } catch {
      return null
    }
  },
  // persistant non précisé : on reste dans le stockage de la session en cours
  save: (token, user, persistant = stockageActuel() === localStorage) => {
    session.clear()
    const stockage = persistant ? localStorage : sessionStorage
    stockage.setItem(TOKEN_KEY, token)
    stockage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear: () => {
    for (const stockage of [localStorage, sessionStorage]) {
      stockage.removeItem(TOKEN_KEY)
      stockage.removeItem(USER_KEY)
    }
  },
}

async function request(url, options = {}) {
  const token = session.getToken()
  // Les en-têtes passés par l'appelant complètent ceux par défaut sans les écraser
  const response = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  // Jeton absent ou expiré : retour à la page de connexion
  if (response.status === 401 && url !== '/auth/login') {
    session.clear()
    window.location.assign('/login')
  }

  // On tente de lire le corps JSON (utile pour récupérer les messages d'erreur du backend)
  let data = null
  const text = await response.text()
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    // Réponse non JSON (page HTML d'Express, proxy Vite...) : jamais affichée telle quelle
    let message = data && data.message
    if (!message && response.status === 404) {
      message = 'Fonction indisponible sur le serveur (404) : redémarrez le backend pour charger la dernière version'
    } else if (!message && (response.status === 502 || response.status === 504)) {
      message = 'Serveur injoignable : vérifiez que le backend est démarré (npm run dev)'
    } else if (!message) {
      message = `Erreur ${response.status}`
    }
    throw new Error(message)
  }

  return data
}

export const api = {
  get: (url) => request(url, { method: 'GET' }),
  post: (url, body) =>
    request(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) =>
    request(url, { method: 'PUT', body: JSON.stringify(body) }),
  del: (url) => request(url, { method: 'DELETE' }),
}
