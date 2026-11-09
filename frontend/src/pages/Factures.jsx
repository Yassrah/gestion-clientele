import { useEffect, useState } from 'react'
import { factureService } from '../services/facture.service'
import { useImpressionFacture } from '../hooks/useImpressionFacture'
import Pagination, { usePagination } from '../components/Pagination'
import Alert from '../components/Alert'
import FiltreSite, { correspondSite } from '../components/FiltreSite'
import { formatDate, formatMoney, formatNombre, toInputDate } from '../utils/format'
import { authService } from '../services/auth.service'

const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

// Période AAAA-MM → « Oct. 2026 »
const libelleMois = (periode) => {
  const [annee, mois] = String(periode || '').split('-')
  return mois ? `${MOIS[Number(mois) - 1]} ${annee}` : '—'
}

// Statut affiché : une facture impayée dont l'échéance est passée est "en retard"
function etatFacture(f) {
  if (f.statut === 'payee') return { label: 'Payée', cls: 'badge-green' }
  const aujourdhui = toInputDate(new Date())
  if (toInputDate(f.date_echeance) < aujourdhui) return { label: 'En retard', cls: 'badge-red' }
  return { label: 'Impayée', cls: 'badge-yellow' }
}

export default function Factures() {
  const [factures, setFactures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState('')
  const [filtreSite, setFiltreSite] = useState('')
  const [generating, setGenerating] = useState(false)
  const impression = useImpressionFacture()
  const admin = authService.estAdmin()

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setFactures(await factureService.getAll())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerer = async () => {
    setGenerating(true)
    setError('')
    setSuccess('')
    try {
      const { message } = await factureService.genererManquantes()
      setSuccess(message)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleStatut = async (f, statut) => {
    const question =
      statut === 'payee'
        ? `Enregistrer le paiement de la facture ${f.numero} ?`
        : `Annuler le paiement de la facture ${f.numero} ?`
    if (!window.confirm(question)) return
    setError('')
    setSuccess('')
    try {
      await factureService.setStatut(f.id, statut)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  // Factures du site filtré : la liste et le résumé (impayés, reste à encaisser) le suivent
  const duSite = factures.filter((f) => correspondSite(f, filtreSite))

  const filtered = duSite.filter((f) => {
    if (filtre && etatFacture(f).label !== filtre) return false
    const q = search.toLowerCase()
    return (
      (f.numero || '').toLowerCase().includes(q) ||
      (f.numero_contrat || '').toLowerCase().includes(q) ||
      libelleMois(f.periode).toLowerCase().includes(q) ||
      (f.nom || '').toLowerCase().includes(q) ||
      (f.prenom || '').toLowerCase().includes(q) ||
      (f.numero_abonne || '').toLowerCase().includes(q)
    )
  })

  const impayees = duSite.filter((f) => f.statut !== 'payee')
  const totalImpaye = impayees.reduce((s, f) => s + Number(f.total), 0)
  const enRetard = impayees.filter((f) => etatFacture(f).label === 'En retard').length

  const pagination = usePagination(filtered, search + '|' + filtre + '|' + filtreSite)
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Factures</h1>
          <p>
            {filtreSite && <>Site {filtreSite}… · </>}
            {duSite.length} facture(s) · {impayees.length} impayée(s)
            {enRetard > 0 && ` dont ${enRetard} en retard`} · reste à encaisser :{' '}
            <strong>{formatMoney(totalImpaye)} Ar</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <FiltreSite value={filtreSite} onChange={setFiltreSite} />
          <div className="search-bar">
            <select value={filtre} onChange={(e) => setFiltre(e.target.value)}>
              <option value="">Tous les statuts</option>
              <option>Impayée</option>
              <option>En retard</option>
              <option>Payée</option>
            </select>
            <input
              type="text"
              placeholder="N° facture, abonné..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn" onClick={handleGenerer} disabled={generating}>
            {generating ? 'Génération...' : 'Générer les factures manquantes'}
          </button>
        </div>
      </div>

      <Alert type="error" message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />
      <Alert
        type="error"
        message={impression.erreur}
        onClose={() => impression.setErreur('')}
      />
      {impression.zoneImpression}

      <div className="card table-wrapper">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">Aucune facture trouvée</div>
        ) : (
          <>
            <table className="table-factures">
              <thead>
                <tr>
                  <th>N° facture</th>
                  <th>Mois</th>
                  <th>Abonné</th>
                  <th>Électricité</th>
                  <th>Eau</th>
                  <th>Total TTC</th>
                  <th>Échéance</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((f) => {
                  const etat = etatFacture(f)
                  return (
                    <tr key={f.id}>
                      <td>{f.numero}</td>
                      <td>{libelleMois(f.periode)}</td>
                      <td>
                        {f.prenom} {f.nom}
                        <div className="cell-sub">
                          {f.numero_abonne} · {f.numero_contrat} · site {f.site_code || '—'}
                        </div>
                      </td>
                      <td className="cell-num">
                        {Number(f.total_electricite) > 0 ? (
                          <>
                            {formatMoney(f.total_electricite)}
                            <div className="cell-sub">{formatNombre(f.conso_electricite)} kWh</div>
                          </>
                        ) : '—'}
                      </td>
                      <td className="cell-num">
                        {Number(f.total_eau) > 0 ? (
                          <>
                            {formatMoney(f.total_eau)}
                            <div className="cell-sub">{formatNombre(f.conso_eau)} m³</div>
                          </>
                        ) : '—'}
                      </td>
                      <td className="cell-num">
                        <strong>{formatMoney(f.total)}</strong>
                      </td>
                      <td>{formatDate(f.date_echeance)}</td>
                      <td>
                        <span className={`badge ${etat.cls}`}>{etat.label}</span>
                        {f.date_paiement && (
                          <div className="cell-sub">le {formatDate(f.date_paiement)}</div>
                        )}
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button
                            className="btn btn-sm"
                            onClick={() => impression.imprimerFacture(f.id)}
                            disabled={impression.enCours('facture', f.id)}
                          >
                            {impression.enCours('facture', f.id) ? 'Préparation...' : 'Imprimer'}
                          </button>
                          {f.statut === 'payee' ? (
                            // Annulation d'un paiement : administrateurs uniquement
                            admin && <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStatut(f, 'impayee')}
                            >
                              Annuler paiement
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStatut(f, 'payee')}
                            >
                              Marquer payée
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination pagination={pagination} />
          </>
        )}
      </div>
    </div>
  )
}
