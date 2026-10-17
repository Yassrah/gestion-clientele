import { useEffect, useState } from 'react'
import { tarifService } from '../services/tarif.service'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import { formatDate, formatMoney } from '../utils/format'

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
      date_debut: t.date_debut ? String(t.date_debut).slice(0, 10) : '',
      date_fin: t.date_fin ? String(t.date_fin).slice(0, 10) : '',
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
          <div className="empty">Aucun tarif trouvé</div>
        ) : (
          <table className="table-tarifs">
            <thead>
              <tr>
                <th>N°</th>
                <th>Type tarif</th>
                <th>Prix unitaire</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.type_tarif}</td>
                  <td>{formatMoney(t.prix_unitaire)}</td>
                  <td>{formatDate(t.date_debut)}</td>
                  <td>{formatDate(t.date_fin)}</td>
                  <td>{t.description}</td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(t)}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(t.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <button className="btn" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <form className="form-grid" onSubmit={handleSubmit}>
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
              <label>Prix unitaire *</label>
              <input
                type="number"
                step="0.01"
                name="prix_unitaire"
                value={form.prix_unitaire}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Date début</label>
              <input
                type="date"
                name="date_debut"
                value={form.date_debut}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Date fin</label>
              <input
                type="date"
                name="date_fin"
                value={form.date_fin}
                onChange={handleChange}
              />
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

