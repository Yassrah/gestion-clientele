// Utilitaires de formatage partagés

// Formate une date ISO (ou 'YYYY-MM-DD') en jj/mm/aaaa
export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d)) return String(value).slice(0, 10)
  return d.toLocaleDateString('fr-FR')
}

// Formate un nombre en montant (ex: 1 234,50)
export function formatMoney(value) {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Retourne une classe de badge selon un statut
export function statutBadge(statut) {
  if (!statut) return ''
  const s = statut.toLowerCase()
  if (s.includes('act') || s.includes('valid')) return 'badge-green'
  if (s.includes('resil') || s.includes('inact') || s.includes('suspend'))
    return 'badge-red'
  if (s.includes('att')) return 'badge-yellow'
  return 'badge-blue'
}
