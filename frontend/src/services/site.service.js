import { api } from './api'

export const siteService = {
  getAll: () => api.get('/site'),
  create: (data) => api.post('/site', data),
  update: (id, data) => api.put(`/site/${id}`, data),
  remove: (id) => api.del(`/site/${id}`),
  importer: (sites) => api.post('/site/import', { sites }),
}
