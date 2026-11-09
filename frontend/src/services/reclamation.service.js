import { api } from './api'

export const reclamationService = {
  getAll: () => api.get('/reclamation'), // { reclamations, types, canaux, statuts }
  get: (id) => api.get(`/reclamation/${id}`),
  compter: () => api.get('/reclamation/compteur'), // { non_resolues }
  create: (data) => api.post('/reclamation', data),
  prendreEnCharge: (id) => api.put(`/reclamation/${id}/prendre`, {}),
  demanderControle: (id) => api.post(`/reclamation/${id}/controle`, {}),
  cloturer: (id, commentaire) => api.put(`/reclamation/${id}/cloturer`, { commentaire }),
  ajouterNote: (id, texte) => api.post(`/reclamation/${id}/suivi`, { texte }),
  remove: (id) => api.del(`/reclamation/${id}`),
}
