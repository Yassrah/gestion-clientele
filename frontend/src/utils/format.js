// Utilitaires de formatage partagés

// Formate une date ISO (ou 'YYYY-MM-DD') en jj/mm/aaaa
export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d)) return String(value).slice(0, 10)
  return d.toLocaleDateString('fr-FR')
}

// Convertit une date renvoyée par l'API en 'YYYY-MM-DD' (jour local, pour <input type="date">)
// Les dates arrivent en UTC (ex: '2026-09-24T21:00:00.000Z' pour le 25/09 à Madagascar) :
// un simple slice(0, 10) donnerait la veille.
export function toInputDate(value) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (isNaN(d)) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Formate un index ou une quantité (ex: 25 339 ; 12,5) — sans décimales inutiles
export function formatNombre(value) {
  if (value === null || value === undefined || value === '') return '—'
  return Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
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

// ---------- Conversion d'un montant en toutes lettres (français) ----------
const LETTRES_UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit',
  'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
]

const LETTRES_DIZAINES = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante',
  'quatre-vingt', 'quatre-vingt',
]

// devantMille : « cent » et « quatre-vingt » restent invariables devant « mille »
function nombreEnLettresPetit(n, devantMille = false) {
  // 0 – 99
  if (n < 20) return LETTRES_UNITES[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  if (d === 8) {
    if (u === 0) return devantMille ? 'quatre-vingt' : 'quatre-vingts'
    return `quatre-vingt-${LETTRES_UNITES[u]}`
  }
  const base = LETTRES_DIZAINES[d]
  if (d === 7 || d === 9) {
    if (d === 7 && u === 1) return 'soixante-et-onze'
    return `${base}-${LETTRES_UNITES[10 + u]}`
  }
  if (u === 0) return base
  if (u === 1) return `${base}-et-un`
  return `${base}-${LETTRES_UNITES[u]}`
}

function nombreEnLettres(n, devantMille = false) {
  // entier >= 0
  if (n === 0) return 'zéro'
  const parts = []
  const millions = Math.floor(n / 1000000)
  const resteApresMillions = n % 1000000
  if (millions === 1) parts.push('un million')
  else if (millions > 1) parts.push(`${nombreEnLettres(millions)} millions`)
  const milliers = Math.floor(resteApresMillions / 1000)
  const reste = resteApresMillions % 1000
  if (milliers === 1) parts.push('mille')
  else if (milliers > 1) parts.push(`${nombreEnLettres(milliers, true)} mille`)
  const centaines = Math.floor(reste / 100)
  const reste2 = reste % 100
  if (centaines > 0) {
    let mot = centaines === 1 ? 'cent' : `${LETTRES_UNITES[centaines]} cent`
    if (centaines > 1 && reste2 === 0 && !devantMille) mot += 's'
    parts.push(mot)
  }
  if (reste2 > 0) parts.push(nombreEnLettresPetit(reste2, devantMille))
  return parts.join(' ')
}

// Ex: montantEnLettres(176661.25) => 'cent soixante-et-six mille six cent soixante-et-un et vingt-cinq centimes'
export function montantEnLettres(valeur) {
  const n = Math.abs(Number(valeur) || 0)
  const entier = Math.floor(n)
  const centimes = Math.round((n - entier) * 100)
  let texte = nombreEnLettres(entier)
  if (centimes > 0) texte += ` et ${nombreEnLettresPetit(centimes)} centimes`
  return texte
}
