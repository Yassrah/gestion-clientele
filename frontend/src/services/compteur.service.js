import { api } from './api'

export const compteurService = {
  getAll: () => api.get('/compteur'),
  create: (data) => api.post('/compteur', data),
  update: (id, data) => api.put(`/compteur/${id}`, data),
  remove: (id) => api.del(`/compteur/${id}`),
}
