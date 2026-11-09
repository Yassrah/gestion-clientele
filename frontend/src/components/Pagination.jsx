import { useEffect, useState } from 'react'

// La première valeur est la taille par défaut
const TAILLES = [5, 10, 25, 50]

// Pagination côté client d'une liste déjà chargée.
// resetKey : valeur (ex. texte de recherche, filtre) dont le changement ramène à la page 1.
export function usePagination(items, resetKey) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TAILLES[0])

  useEffect(() => {
    setPage(1)
  }, [resetKey, pageSize])

  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // Après une suppression, la page courante peut ne plus exister
  const courante = Math.min(page, pageCount)
  const debut = (courante - 1) * pageSize

  return {
    pageItems: items.slice(debut, debut + pageSize),
    page: courante,
    setPage,
    pageSize,
    setPageSize,
    total,
    pageCount,
    debut,
  }
}

// Numéros affichés : première, dernière, courante ± 1, avec « … » entre les trous
function numeros(page, pageCount) {
  const garder = new Set([1, pageCount, page - 1, page, page + 1])
  const liste = [...garder].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b)
  const resultat = []
  liste.forEach((n, i) => {
    if (i > 0 && n - liste[i - 1] > 1) resultat.push(`…${n}`)
    resultat.push(n)
  })
  return resultat
}

export default function Pagination({ pagination }) {
  const { page, setPage, pageSize, setPageSize, total, pageCount, debut } = pagination
  if (total === 0) return null

  const fin = Math.min(debut + pageSize, total)

  return (
    <nav className="pagination" aria-label="Pagination">
      <div className="pagination-info">
        Affichage <strong>{debut + 1}–{fin}</strong> sur <strong>{total}</strong>
      </div>

      <div className="pagination-pages">
        <button
          className="pagination-btn"
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          aria-label="Page précédente"
        >
          ‹
        </button>
        {numeros(page, pageCount).map((n) =>
          typeof n === 'string' ? (
            <span key={n} className="pagination-ellipse">…</span>
          ) : (
            <button
              key={n}
              className={`pagination-btn ${n === page ? 'active' : ''}`}
              onClick={() => setPage(n)}
              aria-current={n === page ? 'page' : undefined}
            >
              {n}
            </button>
          )
        )}
        <button
          className="pagination-btn"
          onClick={() => setPage(page + 1)}
          disabled={page === pageCount}
          aria-label="Page suivante"
        >
          ›
        </button>
      </div>

      <label className="pagination-taille">
        <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
          {TAILLES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        par page
      </label>
    </nav>
  )
}
