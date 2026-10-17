import { useEffect, useState } from 'react'
import { compteurService } from '../services/compteur.service'
import { contratService } from '../services/contrat.service'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import { formatDate, statutBadge } from '../utils/format'

const emptyForm = {
  numero_compteur: '',
  type_compteur: '',
  marque: '',
  date_installation: '',
  statut: '',
  contrat_id: '',
}

export default function Compteurs() {
  const [compteurs, setCompteurs] = useState([])
  const [contrats, setContrats] = useState([])
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
      const [c, ct] = await Promise.all([
        compteurService.getAll(),
        contratService.getAll(),
      ])
      setCompteurs(c)
      setContrats(ct)
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
      date_installation: c.date_installation
        ? String(c.date_installation).slice(0, 10)
        : '',
      statut: c.statut || '',
      contrat_id: c.contrat_id || '',
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
        await compteurService.update(editing.id, form)
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

      <div className="card table-wrapper">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">Aucun compteur trouvé</div>
        ) : (
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
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
                    <div className="actions-cell">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(c)}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(c.id)}
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
              <button className="btn" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <form className="form-grid" onSubmit={handleSubmit}>
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
              <label>Statut</label>
              <input
                name="statut"
                value={form.statut}
                onChange={handleChange}
                placeholder="Actif, Hors service..."
              />
            </div>
            <div className="form-group">
              <label>Contrat</label>
              <select
                name="contrat_id"
                value={form.contrat_id}
                onChange={handleChange}
              >
                <option value="">-- Aucun --</option>
                {contrats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero_contrat}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

