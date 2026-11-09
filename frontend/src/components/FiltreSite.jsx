import { useEffect, useState } from 'react'
import { siteService } from '../services/site.service'

// Vrai si l'élément (qui porte site_code) appartient au(x) site(s) dont la référence
// commence par le filtre : « 611 » → site 611 ; « 61 » → tous les sites 61x (Toliara ville).
export function correspondSite(item, filtre) {
  const f = String(filtre || '').trim()
  return !f || String(item.site_code || '').startsWith(f)
}

// Champ « Réf. site » avec suggestions (code — quartier) et rappel du quartier trouvé
export default function FiltreSite({ value, onChange }) {
  const [sites, setSites] = useState([])

  useEffect(() => {
    siteService.getAll().then(setSites).catch(() => setSites([]))
  }, [])

  const f = value.trim()
  const trouves = f ? sites.filter((s) => s.code.startsWith(f)) : []
  const resume =
    trouves.length === 1
      ? `${trouves[0].quartier}, ${trouves[0].ville}`
      : trouves.length > 1
        ? `${trouves.length} sites`
        : f
          ? 'Aucun site'
          : ''

  return (
    <div className="filtre-site">
      <input
        type="text"
        inputMode="numeric"
        list="liste-sites"
        placeholder="Réf. site (ex : 611)"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        aria-label="Filtrer par référence de site"
      />
      <datalist id="liste-sites">
        {sites.map((s) => (
          <option key={s.id} value={s.code}>
            {s.quartier} — {s.ville}
          </option>
        ))}
      </datalist>
      {resume && <span className="filtre-site-resume">{resume}</span>}
    </div>
  )
}
