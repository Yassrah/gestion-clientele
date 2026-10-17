// Service API centralisé pour communiquer avec le backend Express.
// Grâce au proxy Vite, les appels vers /api sont redirigés vers http://localhost:5000

const BASE = '/api'

async function request(url, options = {}) {
  const response = await fetch(`${BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  // On tente de lire le corps JSON (utile pour récupérer les messages d'erreur du backend)
  let data = null
  const text = await response.text()
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const message =
      (data && data.message) ||
      (typeof data === 'string' && data) ||
      `Erreur ${response.status}`
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
