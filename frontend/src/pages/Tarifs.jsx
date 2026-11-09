import { useEffect, useState } from 'react'
import { tarifService } from '../services/tarif.service'
import Pagination, { usePagination } from '../components/Pagination'
import Alert from '../components/Alert'
import { authService } from '../services/auth.service'
import Modal from '../components/Modal'
import { formatDate, formatMoney, toInputDate } from '../utils/format'

// Validité d'un tarif aujourd'hui (les relevés hors période ne sont pas facturables)
function etatTarif(t) {
  const aujourdhui = toInputDate(new Date())
  if (toInputDate(t.date_debut) > aujourdhui) return { label: 'À venir', cls: 'badge-blue' }
  if (t.date_fin && toInputDate(t.date_fin) < aujourdhui) return { label: 'Expiré', cls: 'badge-red' }
  return { label: 'En vigueur', cls: 'badge-green' }
}

const emptyForm = {
  type_tarif: '',
  prix_unitaire: '',
  date_debut: '',
  date_fin: '',
  description: '',
}

export default function Tarifs() {
  const [tarifs, setTarifs] = useState([])
  const [loading, setLoading] = useState(true)
  // Suppressions (et gestion des tarifs) réservées aux administrateurs
  const admin = authService.estAdmin()
  const [error, setError] = useState('')
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
      setTarifs(await tarifService.getAll())
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

  const openEdit = (t) => {
    setEditing(t)
    setForm({
      type_tarif: t.type_tarif || '',
      prix_unitaire: t.prix_unitaire || '',
      date_debut: toInputDate(t.date_debut),
      date_fin: toInputDate(t.date_fin),
      description: t.description || '',
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
    try {
      if (editing) {
        await tarifService.update(editing.id, form)
      } else {
        await tarifService.create(form)
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
    if (!window.confirm('Supprimer ce tarif ?')) return
    try {
      await tarifService.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = tarifs.filter((t) => {
    const q = search.toLowerCase()
    return (
      (t.type_tarif || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    )
  })
  const pagination = usePagination(filtered, search)
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tarifs</h1>
          <p>{tarifs.length} tarif(s) enregistré(s)</p>
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
          {admin && (
            <button className="btn" onClick={openCreate}>
              + Ajouter
            </button>
          )}
        </div>
      </div>

      <Alert type="error" message={error} onClose={() => setError('')} />

      <div className="card table-wrapper">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">Aucun tarif trouvé</div>
        ) : (
          <>
            <table className="table-tarifs">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Type tarif</th>
                  <th>Prix unitaire</th>
                  <th>Début</th>
                  <th>Fin</th>
                  <th>Validité</th>
                  <th>Compteurs</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.type_tarif}</td>
                    <td>{formatMoney(t.prix_unitaire)}</td>
                    <td>{formatDate(t.date_debut)}</td>
                    <td>{formatDate(t.date_fin)}</td>
                    <td>
                      <span className={`badge ${etatTarif(t).cls}`}>{etatTarif(t).label}</span>
                    </td>
                    <td>{t.nb_compteurs}</td>
                    <td>{t.description}</td>
                    <td>
                      <div className="actions-cell">
                        {admin && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(t)}
                          >
                            Modifier
                          </button>
                        )}
                        {admin && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(t.id)}
                            disabled={t.nb_compteurs > 0}
                            title={t.nb_compteurs > 0 ? 'Tarif utilisé par des compteurs' : undefined}
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
          title={editing ? 'Modifier un tarif' : 'Nouveau tarif'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Annuler
              </button>
              <button className="btn" type="submit" form="tarif-form" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <form id="tarif-form" className="form-grid" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Type de tarif *</label>
              <input
                name="type_tarif"
                value={form.type_tarif}
                onChange={handleChange}
                placeholder="Domestique, Industriel..."
                required
              />
            </div>
            <div className="form-group">
              <label>Prix unitaire (Ar) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="prix_unitaire"
                value={form.prix_unitaire}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Valable à partir du *</label>
              <input
                type="date"
                name="date_debut"
                value={form.date_debut}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Jusqu'au</label>
              <input
                type="date"
                name="date_fin"
                value={form.date_fin}
                onChange={handleChange}
                min={form.date_debut || undefined}
              />
              <small className="form-hint">Vide = sans date de fin</small>
            </div>
            <div className="form-group full">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

