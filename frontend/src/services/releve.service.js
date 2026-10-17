import { api } from './api'

export const releveService = {
  getAll: () => api.get('/releve'),
  create: (data) => api.post('/releve', data),
  update: (id, data) => api.put(`/releve/${id}`, data),
  remove: (id) => api.del(`/releve/${id}`),
  getByAbonne: (nom) => api.get(`/releve/abonne/${encodeURIComponent(nom)}`),
}
