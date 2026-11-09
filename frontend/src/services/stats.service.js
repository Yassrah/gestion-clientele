import { api } from './api'

export const statsService = {
  // filtres : { annee, mois, service } (valeurs vides ignorées)
  get: (filtres = {}) => {
    const params = new URLSearchParams(
      Object.entries(filtres).filter(([, v]) => v !== '' && v != null)
    )
    const qs = params.toString()
    return api.get(`/stats${qs ? `?${qs}` : ''}`)
  },
}
