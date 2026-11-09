import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { reclamationService } from '../services/reclamation.service'
import { abonneService } from '../services/abonne.service'
import { authService } from '../services/auth.service'
import Pagination, { usePagination } from '../components/Pagination'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import { IconReclamations } from '../components/Icons'

// Suivi des réclamations des abonnés (maquette « Réclamations ») :
// filtres par statut, liste à gauche, fiche détaillée et actions à droite.

const FILTRES = ['Toutes', 'Ouverte', 'En cours', 'Résolue']
const BADGE = { Ouverte: 'badge-yellow', 'En cours': 'badge-blue', Résolue: 'badge-gris' }

// Notifie le menu (pastille du nombre de réclamations non résolues)
const signalerMaj = () => window.dispatchEvent(new Event('reclamations-maj'))

const dateCourte = (v) =>
  v ? new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
const dateSuivi = (v) => {
  const d = new Date(v)
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

const formulaireVide = { abonne_id: '', type: '', canal: '', description: '' }

export default function Reclamations() {
  const [params, setParams] = useSearchParams()
  const [reclamations, setReclamations] = useState([])
  const [choix, setChoix] = useState({ types: [], canaux: [] })
  const [abonnes, setAbonnes] = useState([])
  const [filtre, setFiltre] = useState('Toutes')
  const [search, setSearch] = useState('')
  const [fiche, setFiche] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [enCours, setEnCours] = useState(false) // action en cours sur la fiche
  const [note, setNote] = useState('')
  const [nouvelle, setNouvelle] = useState(null) // formulaire de création ouvert
  const [cloture, setCloture] = useState(null) // { commentaire } : fenêtre de clôture ouverte
  const admin = authService.estAdmin()

  const idSelection = Number(params.get('id')) || null

  const charger = async () => {
    try {
      const data = await reclamationService.getAll()
      setReclamations(data.reclamations)
      setChoix({ types: data.types, canaux: data.canaux })
      return data.reclamations
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    charger()
    abonneService.getAll().then(setAbonnes).catch(() => {})
  }, [])

  // Fiche affichée : celle de l'URL (?id=), sinon la première de la liste filtrée
  const filtrees = reclamations.filter((r) => {
    if (filtre !== 'Toutes' && r.statut !== filtre) return false
    const q = search.trim().toLowerCase()
    return (
      !q ||
      [r.numero, r.type, r.nom, r.prenom, r.numero_abonne, r.agence].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    )
  })
  const pagination = usePagination(filtrees, filtre + '|' + search)
  const idAffiche = idSelection || filtrees[0]?.id || null

  useEffect(() => {
    if (!idAffiche) {
      setFiche(null)
      return
    }
    if (fiche?.id === idAffiche) return
    reclamationService.get(idAffiche).then(setFiche).catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idAffiche])

  const selectionner = (id) => {
    setNotice('')
    setNote('')
    setParams({ id: String(id) })
  }

  // Après une action : fiche et liste à jour
  const appliquer = async (requete, message) => {
    setEnCours(true)
    setError('')
    setNotice('')
    try {
      const maj = await requete()
      setFiche(maj)
      setReclamations((liste) => liste.map((r) => (r.id === maj.id ? { ...r, ...maj } : r)))
      setNotice(message)
      signalerMaj()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setEnCours(false)
    }
  }

  const handleNote = async (e) => {
    e.preventDefault()
    if (await appliquer(() => reclamationService.ajouterNote(fiche.id, note), 'Note ajoutée au suivi.')) setNote('')
  }

  const handleCloture = async (e) => {
    e.preventDefault()
    const ok = await appliquer(
      () => reclamationService.cloturer(fiche.id, cloture.commentaire),
      `Réclamation ${fiche.numero} clôturée.`
    )
    if (ok) setCloture(null)
  }

  const handleSupprimer = async () => {
    if (!window.confirm(`Supprimer la réclamation ${fiche.numero} ? (erreur de saisie uniquement)`)) return
    try {
      await reclamationService.remove(fiche.id)
      setFiche(null)
      setParams({})
      await charger()
      signalerMaj()
    } catch (err) {
      setError(err.message)
    }
  }

  // Canal « Guichet » : complété par l'agence de l'abonné (ex. « Guichet Toliara »)
  const handleCreer = async (e) => {
    e.preventDefault()
    setError('')
    const abonne = abonnes.find((a) => String(a.id) === String(nouvelle.abonne_id))
    const canal =
      nouvelle.canal === 'Guichet' && abonne?.site_ville ? `Guichet ${abonne.site_ville}` : nouvelle.canal
    try {
      const creee = await reclamationService.create({ ...nouvelle, canal })
      setNouvelle(null)
      setFiltre('Toutes')
      await charger()
      setFiche(creee)
      setParams({ id: String(creee.id) })
      setNotice(`Réclamation ${creee.numero} enregistrée.`)
      signalerMaj()
    } catch (err) {
      setError(err.message)
    }
  }

  const compte = (f) => reclamations.filter((r) => f === 'Toutes' || r.statut === f).length
  const nonResolues = reclamations.filter((r) => r.statut !== 'Résolue').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Réclamations</h1>
          <p>
            {reclamations.length} réclamation(s) · {nonResolues} non résolue(s)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div className="search-bar">
            <input
              type="text"
              placeholder="N°, abonné, type, agence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn" onClick={() => { setError(''); setNouvelle(formulaireVide) }}>
            + Nouvelle réclamation
          </button>
        </div>
      </div>

      {!nouvelle && !cloture && <Alert type="error" message={error} onClose={() => setError('')} />}

      <div className="reclam-grille">
        {/* Liste */}
        <div className="reclam-liste">
          <div className="segments" role="tablist" aria-label="Filtrer par statut">
            {FILTRES.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filtre === f}
                className={filtre === f ? 'actif' : ''}
                onClick={() => setFiltre(f)}
              >
                {f} · {compte(f)}
              </button>
            ))}
          </div>

          <div className="card reclam-cartes">
            {loading ? (
              <div className="loading">Chargement...</div>
            ) : filtrees.length === 0 ? (
              <div className="empty">Aucune réclamation</div>
            ) : (
              <>
                <ul className="reclam-items">
                  {pagination.pageItems.map((r) => (
                    <li key={r.id}>
                      <button
                        className={`reclam-item ${r.id === idAffiche ? 'selection' : ''}`}
                        onClick={() => selectionner(r.id)}
                      >
                        <span className="reclam-item-texte">
                          <strong>{r.type}</strong>
                          <span>
                            {r.numero} · {r.prenom} {r.nom} · {dateCourte(r.date_reception)}
                          </span>
                        </span>
                        <span className={`badge ${BADGE[r.statut]}`}>{r.statut}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Pagination pagination={pagination} />
              </>
            )}
          </div>
        </div>

        {/* Fiche */}
        {fiche ? (
          <section className="card reclam-fiche" aria-live="polite">
            <div className="reclam-fiche-entete">
              <div>
                <span className="reclam-kicker">
                  {fiche.numero} · reçue le {dateCourte(fiche.date_reception)} · {fiche.canal}
                </span>
                <h2>{fiche.type}</h2>
              </div>
              <span className={`badge ${BADGE[fiche.statut]}`}>{fiche.statut}</span>
            </div>

            <Alert type="success" message={notice} onClose={() => setNotice('')} />

            <p className="reclam-description">{fiche.description}</p>

            <dl className="reclam-infos">
              <dt>Abonné</dt>
              <dd>
                <Link to={`/abonnes?q=${encodeURIComponent(fiche.numero_abonne)}`} className="reclam-lien">
                  {fiche.prenom} {fiche.nom} →
                </Link>
              </dd>
              <dt>Réf. client</dt>
              <dd>{fiche.numero_abonne}</dd>
              <dt>Agence</dt>
              <dd>
                {fiche.agence || '—'}
                {fiche.site_code && <span className="cell-sub"> · site {fiche.site_code} {fiche.site_quartier}</span>}
              </dd>
              <dt>Téléphone</dt>
              <dd>{fiche.telephone || '—'}</dd>
              <dt>Assignée à</dt>
              <dd>{fiche.assignee_nom || '—'}</dd>
              {fiche.date_resolution && (
                <>
                  <dt>Résolue le</dt>
                  <dd>{dateCourte(fiche.date_resolution)}</dd>
                </>
              )}
            </dl>

            <div className="reclam-suivi">
              <h3>Suivi</h3>
              <ol>
                {fiche.suivi.map((s) => (
                  <li key={s.id}>
                    <time>{dateSuivi(s.date_suivi)}</time>
                    <span>
                      {s.texte}
                      {s.auteur && <span className="cell-sub"> — {s.auteur}</span>}
                    </span>
                  </li>
                ))}
              </ol>
              {fiche.statut !== 'Résolue' && (
                <form className="reclam-note" onSubmit={handleNote}>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ajouter une note au suivi..."
                    aria-label="Note de suivi"
                  />
                  <button className="btn btn-secondary btn-sm" disabled={enCours || note.trim().length < 3}>
                    Ajouter
                  </button>
                </form>
              )}
            </div>

            <div className="reclam-actions">
              {fiche.statut === 'Ouverte' && (
                <button
                  className="btn btn-secondary"
                  disabled={enCours}
                  onClick={() =>
                    appliquer(() => reclamationService.prendreEnCharge(fiche.id), 'Réclamation prise en charge.')
                  }
                >
                  Prendre en charge
                </button>
              )}
              {fiche.statut !== 'Résolue' && (
                <>
                  <button
                    className="btn btn-secondary"
                    disabled={enCours}
                    onClick={() =>
                      appliquer(
                        () => reclamationService.demanderControle(fiche.id),
                        `Relevé de contrôle demandé pour ${fiche.prenom} ${fiche.nom}.`
                      )
                    }
                  >
                    Demander un relevé de contrôle
                  </button>
                  <button className="btn" disabled={enCours} onClick={() => { setError(''); setCloture({ commentaire: '' }) }}>
                    Clôturer · résolue
                  </button>
                </>
              )}
              {admin && (
                <button className="btn btn-danger btn-sm reclam-supprimer" onClick={handleSupprimer}>
                  Supprimer
                </button>
              )}
            </div>
          </section>
        ) : (
          !loading && (
            <section className="card reclam-fiche reclam-fiche-vide">
              <IconReclamations size={32} />
              <p>Sélectionnez une réclamation pour voir son détail.</p>
            </section>
          )
        )}
      </div>

      {nouvelle && (
        <Modal
          title="Nouvelle réclamation"
          onClose={() => setNouvelle(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setNouvelle(null)}>
                Annuler
              </button>
              <button className="btn" type="submit" form="reclamation-form">
                Enregistrer
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <form id="reclamation-form" className="form-grid" onSubmit={handleCreer}>
            <div className="form-group full">
              <label>Abonné *</label>
              <select
                value={nouvelle.abonne_id}
                onChange={(e) => setNouvelle({ ...nouvelle, abonne_id: e.target.value })}
                required
              >
                <option value="">-- Sélectionner --</option>
                {abonnes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom} {a.prenom} ({a.numero_abonne}{a.site_code ? ` · site ${a.site_code}` : ''})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Type *</label>
              <select value={nouvelle.type} onChange={(e) => setNouvelle({ ...nouvelle, type: e.target.value })} required>
                <option value="">-- Sélectionner --</option>
                {choix.types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Reçue par *</label>
              <select value={nouvelle.canal} onChange={(e) => setNouvelle({ ...nouvelle, canal: e.target.value })} required>
                <option value="">-- Sélectionner --</option>
                {choix.canaux.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group full">
              <label>Description *</label>
              <textarea
                rows="4"
                minLength={10}
                value={nouvelle.description}
                onChange={(e) => setNouvelle({ ...nouvelle, description: e.target.value })}
                placeholder="Ce que signale l'abonné : facture, mois, montant, compteur..."
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {cloture && (
        <Modal
          title={`Clôturer la réclamation ${fiche?.numero}`}
          onClose={() => setCloture(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setCloture(null)}>
                Annuler
              </button>
              <button className="btn" type="submit" form="cloture-form" disabled={enCours}>
                Clôturer · résolue
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <form id="cloture-form" className="form-grid" onSubmit={handleCloture}>
            <div className="form-group full">
              <label>Résolution (facultatif)</label>
              <textarea
                rows="3"
                value={cloture.commentaire}
                onChange={(e) => setCloture({ commentaire: e.target.value })}
                placeholder="Ex. facture rectifiée, avoir de 4 120 Ar, abonné informé par SMS."
              />
              <small className="form-hint">Ajouté à l'historique de suivi de la réclamation.</small>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
