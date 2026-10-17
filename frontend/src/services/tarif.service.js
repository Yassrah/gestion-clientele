import { api } from './api'

export const tarifService = {
  getAll: () => api.get('/tarif'),
  create: (data) => api.post('/tarif', data),
  update: (id, data) => api.put(`/tarif/${id}`, data),
  remove: (id) => api.del(`/tarif/${id}`),
}
