import { api, session } from './api'

export const authService = {
  // seSouvenir : garde la session après fermeture du navigateur (voir session dans api.js)
  login: async (username, password, seSouvenir = true) => {
    const { token, user } = await api.post('/auth/login', { username, password })
    session.save(token, user, seSouvenir)
    return user
  },
  logout: () => session.clear(),
  getUser: () => session.getUser(),
  isAuthenticated: () => !!session.getToken(),
  // Rôle admin : suppressions, gestion des tarifs, annulation de paiement.
  // L'affichage s'y adapte ; le serveur reste seul juge (routes protégées par exigerAdmin).
  estAdmin: () => session.getUser()?.role === 'admin',
  // Relit le compte (et son rôle) côté serveur : utile après un changement de rôle
  rafraichir: async () => {
    const user = await api.get('/auth/me')
    session.save(session.getToken(), user)
    return user
  },
}
