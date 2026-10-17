import { api } from './api'

export const contratService = {
  getAll: () => api.get('/contrat'),
  create: (data) => api.post('/contrat', data),
  update: (id, data) => api.put(`/contrat/${id}`, data),
  remove: (id) => api.del(`/contrat/${id}`),
}
