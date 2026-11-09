import { useEffect, useState } from 'react'
import { compteurService } from '../services/compteur.service'
import { contratService } from '../services/contrat.service'
import { tarifService } from '../services/tarif.service'
import Pagination, { usePagination } from '../components/Pagination'
import Alert from '../components/Alert'
import { authService } from '../services/auth.service'
import Modal from '../components/Modal'
import { formatDate, formatMoney, statutBadge, toInputDate } from '../utils/format'

const emptyForm = {
  numero_compteur: '',
  type_compteur: '',
  marque: '',
  date_installation: '',
  statut: 'Actif',
  contrat_id: '',
  tarif_id: '',
}

// Mêmes valeurs que STATUTS_COMPTEUR (backend/utils/integrite.js)
const STATUTS = ['Actif', 'Hors service']

const libelleTarif = (t) => {
  const expire = t.date_fin && toInputDate(t.date_fin) < toInputDate(new Date())
  return `${t.description || `Tarif ${t.type_tarif}`} — ${formatMoney(t.prix_unitaire)} Ar/unité${expire ? ' (expiré)' : ''}`
}

export default function Compteurs() {
  const [compteurs, setCompteurs] = useState([])
  const [contrats, setContrats] = useState([])
  const [tarifs, setTarifs] = useState([])
  const [loading, setLoading] = useState(true)
  // Suppressions (et gestion des tarifs) réservées aux administrateurs
  const admin = authService.estAdmin()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const [c, ct, t] = await Promise.all([
        compteurService.getAll(),
        contratService.getAll(),
        tarifService.getAll(),
      ])
      setCompteurs(c)
      setContrats(ct)
      setTarifs(t)
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
    setShowModal(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({
      numero_compteur: c.numero_compteur || '',
      type_compteur: c.type_compteur || '',
      marque: c.marque || '',
      date_installation: toInputDate(c.date_installation),
      statut: c.statut || 'Actif',
      contrat_id: c.contrat_id || '',
      tarif_id: c.tarif_id || '',
    })
    setError('')
    setShowModal(true)
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (editing) {
        const saved = await compteurService.update(editing.id, form)
        if (saved.factures_generees > 0) {
          setNotice(`${saved.factures_generees} relevé(s) de ce compteur ajouté(s) aux factures`)
        }
      } else {
        await compteurService.create(form)
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
    if (!window.confirm('Supprimer ce compteur ?')) return
    try {
      await compteurService.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = compteurs.filter((c) => {
    const q = search.toLowerCase()
    return (
      (c.numero_compteur || '').toLowerCase().includes(q) ||
      (c.type_compteur || '').toLowerCase().includes(q) ||
      (c.marque || '').toLowerCase().includes(q) ||
      (c.statut || '').toLowerCase().includes(q)
    )
  })
  const pagination = usePagination(filtered, search)
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Compteurs</h1>
          <p>{compteurs.length} compteur(s) enregistré(s)</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
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
      <Alert type="success" message={notice} onClose={() => setNotice('')} />

      <div className="card table-wrapper">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">Aucun compteur trouvé</div>
        ) : (
          <>
            <table className="table-compteurs">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Numéro</th>
                  <th>Type</th>
                  <th>Marque</th>
                  <th>Installation</th>
                  <th>Statut</th>
                  <th>Contrat</th>
                  <th>Tarif</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.numero_compteur}</td>
                    <td>{c.type_compteur}</td>
                    <td>{c.marque}</td>
                    <td>{formatDate(c.date_installation)}</td>
                    <td>
                      <span className={`badge ${statutBadge(c.statut)}`}>
                        {c.statut}
                      </span>
                    </td>
                    <td>{c.contrat_id ? `#${c.contrat_id}` : '—'}</td>
                    <td>
                      {(() => {
                        const t = tarifs.find((x) => x.id === c.tarif_id)
                        return t ? (
                          `${formatMoney(t.prix_unitaire)} Ar`
                        ) : (
                          <span className="badge badge-red" title="Ses relevés ne peuvent pas être facturés">
                            Aucun tarif
                          </span>
                        )
                      })()}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(c)}
                        >
                          Modifier
                        </button>
                        {admin && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(c.id)}
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
          title={editing ? 'Modifier un compteur' : 'Nouveau compteur'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Annuler
              </button>
              <button className="btn" type="submit" form="compteur-form" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <form id="compteur-form" className="form-grid" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Numéro compteur *</label>
              <input
                name="numero_compteur"
                value={form.numero_compteur}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Type de compteur</label>
              <input
                name="type_compteur"
                value={form.type_compteur}
                onChange={handleChange}
                placeholder="Électricité, Eau..."
              />
            </div>
            <div className="form-group">
              <label>Marque</label>
              <input
                name="marque"
                value={form.marque}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Date d'installation</label>
              <input
                type="date"
                name="date_installation"
                value={form.date_installation}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Statut *</label>
              <select name="statut" value={form.statut} onChange={handleChange} required>
                {STATUTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Contrat *</label>
              <select
                name="contrat_id"
                value={form.contrat_id}
                onChange={handleChange}
                required
              >
                <option value="">-- Sélectionner --</option>
                {contrats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero_contrat}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group full">
              <label>Tarif *</label>
              <select
                name="tarif_id"
                value={form.tarif_id}
                onChange={handleChange}
                required
              >
                <option value="">-- Sélectionner --</option>
                {tarifs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {libelleTarif(t)}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                Prix appliqué aux relevés de ce compteur lors de la facturation
              </small>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

