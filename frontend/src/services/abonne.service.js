import { api } from './api'

export const abonneService = {
  getAll: () => api.get('/abonne'),
  create: (data) => api.post('/abonne', data),
  update: (id, data) => api.put(`/abonne/${id}`, data),
  remove: (id) => api.del(`/abonne/${id}`),
}
