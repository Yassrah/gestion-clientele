import { api } from './api'

export const factureService = {
  getAll: () => api.get('/facture'),
  getImpression: (id) => api.get(`/facture/${id}/impression`),
  setStatut: (id, statut) => api.put(`/facture/${id}/statut`, { statut }),
  genererManquantes: () => api.post('/facture/generer', {}),
}
