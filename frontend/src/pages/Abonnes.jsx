import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { abonneService } from '../services/abonne.service'
import Pagination, { usePagination } from '../components/Pagination'
import Alert from '../components/Alert'
import { authService } from '../services/auth.service'
import Modal from '../components/Modal'
import { erreursContact } from '../utils/validation'
import FiltreSite, { correspondSite } from '../components/FiltreSite'
import { siteService } from '../services/site.service'

const emptyForm = {
  numero_abonne: '',
  nom: '',
  prenom: '',
  site_id: '',
  adresse: '',
  telephone: '',
  email: '',
}

export default function Abonnes() {
  const [abonnes, setAbonnes] = useState([])
  const [loading, setLoading] = useState(true)
  // Suppressions (et gestion des tarifs) réservées aux administrateurs
  const admin = authService.estAdmin()
  const [error, setError] = useState('')
  // ?q= : recherche pré-remplie (ex. lien « Abonné → » d'une réclamation)
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [sites, setSites] = useState([])
  const [filtreSite, setFiltreSite] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      // La liste des abonnés s'affiche même si les sites ne peuvent pas être chargés
      const [a, s] = await Promise.allSettled([abonneService.getAll(), siteService.getAll()])
      if (a.status === 'rejected') throw a.reason
      setAbonnes(a.value)
      if (s.status === 'fulfilled') setSites(s.value)
      else setError(s.reason.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setFieldErrors({})
    setShowModal(true)
  }

  const openEdit = (a) => {
    setEditing(a)
    setForm({
      numero_abonne: a.numero_abonne || '',
      nom: a.nom || '',
      prenom: a.prenom || '',
      site_id: a.site_id || '',
      adresse: a.adresse || '',
      telephone: a.telephone || '',
      email: a.email || '',
    })
    setError('')
    setFieldErrors({})
    setShowModal(true)
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    // L'erreur d'un champ disparaît dès qu'on le corrige
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: undefined })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const erreurs = erreursContact(form)
    setFieldErrors(erreurs)
    if (Object.keys(erreurs).length > 0) return
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await abonneService.update(editing.id, form)
      } else {
        await abonneService.create(form)
      }
      setShowModal(false)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet abonné ?')) return
    try {
      await abonneService.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = abonnes.filter((a) => {
    if (!correspondSite(a, filtreSite)) return false
    const q = search.toLowerCase()
    return (
      (a.nom || '').toLowerCase().includes(q) ||
      (a.prenom || '').toLowerCase().includes(q) ||
      (a.numero_abonne || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q) ||
      (a.site_quartier || '').toLowerCase().includes(q)
    )
  })
  const pagination = usePagination(filtered, search + '|' + filtreSite)
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Abonnés</h1>
          <p>{abonnes.length} abonné(s) enregistré(s)</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <FiltreSite value={filtreSite} onChange={setFiltreSite} />
          <div className="search-bar">
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn" onClick={openCreate}>
            + Ajouter
          </button>
        </div>
      </div>

      <Alert type="error" message={error} onClose={() => setError('')} />

      <div className="card table-wrapper">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">Aucun abonné trouvé</div>
        ) : (
          <>
            <table className="table-abonnes">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Numéro</th>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Site</th>
                  <th>Adresse</th>
                  <th>Téléphone</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((a) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>{a.numero_abonne}</td>
                    <td>{a.nom}</td>
                    <td>{a.prenom}</td>
                    <td>
                      {a.site_code ? (
                        <>
                          <span className="badge badge-blue badge-site">{a.site_code}</span>
                          <div className="cell-sub">{a.site_quartier}</div>
                        </>
                      ) : (
                        <span className="badge badge-red">Aucun</span>
                      )}
                    </td>
                    <td>{a.adresse}</td>
                    <td>{a.telephone}</td>
                    <td>{a.email}</td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(a)}
                        >
                          Modifier
                        </button>
                        {admin && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(a.id)}
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={pagination} />
          </>
        )}
      </div>

      {showModal && (
        <Modal
          title={editing ? 'Modifier un abonné' : 'Nouvel abonné'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Annuler
              </button>
              <button className="btn" type="submit" form="abonne-form" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <form id="abonne-form" className="form-grid" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Numéro abonné *</label>
              <input
                name="numero_abonne"
                value={form.numero_abonne}
                onChange={handleChange}
                maxLength={20}
                required
              />
            </div>
            <div className="form-group">
              <label>Nom *</label>
              <input name="nom" value={form.nom} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Prénom *</label>
              <input
                name="prenom"
                value={form.prenom}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Téléphone</label>
              <input
                type="tel"
                name="telephone"
                value={form.telephone}
                onChange={handleChange}
                placeholder="0325611411"
                className={fieldErrors.telephone ? 'invalid' : ''}
              />
              {fieldErrors.telephone && (
                <small className="form-error">{fieldErrors.telephone}</small>
              )}
            </div>
            <div className="form-group">
              <label>Site (quartier) *</label>
              <select name="site_id" value={form.site_id} onChange={handleChange} required>
                <option value="">-- Sélectionner --</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.quartier}, {s.ville}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Adresse</label>
              <input
                name="adresse"
                value={form.adresse}
                onChange={handleChange}
                placeholder="Lot, rue..."
              />
            </div>
            <div className="form-group full">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="nom@domaine.com"
                className={fieldErrors.email ? 'invalid' : ''}
              />
              {fieldErrors.email && <small className="form-error">{fieldErrors.email}</small>}
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

