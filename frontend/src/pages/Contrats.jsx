import { useEffect, useState } from 'react'
import { contratService } from '../services/contrat.service'
import { abonneService } from '../services/abonne.service'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import { formatDate, formatMoney, statutBadge } from '../utils/format'

const emptyForm = {
  numero_contrat: '',
  abonne_id: '',
  type_contrat: '',
  date_debut: '',
  date_fin: '',
  statut: '',
  montant: '',
}

export default function Contrats() {
  const [contrats, setContrats] = useState([])
  const [abonnes, setAbonnes] = useState([])
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
      const [c, a] = await Promise.all([
        contratService.getAll(),
        abonneService.getAll(),
      ])
      setContrats(c)
      setAbonnes(a)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const abonneName = (id) => {
    const a = abonnes.find((x) => String(x.id) === String(id))
    return a ? `${a.nom} ${a.prenom}` : `#${id}`
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
      numero_contrat: c.numero_contrat || '',
      abonne_id: c.abonne_id || '',
      type_contrat: c.type_contrat || '',
      date_debut: c.date_debut ? String(c.date_debut).slice(0, 10) : '',
      date_fin: c.date_fin ? String(c.date_fin).slice(0, 10) : '',
      statut: c.statut || '',
      montant: c.montant || '',
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
        await contratService.update(editing.id, form)
      } else {
        await contratService.create(form)
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
    if (!window.confirm('Supprimer ce contrat ?')) return
    try {
      await contratService.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = contrats.filter((c) => {
    const q = search.toLowerCase()
    return (
      (c.numero_contrat || '').toLowerCase().includes(q) ||
      (c.type_contrat || '').toLowerCase().includes(q) ||
      (c.statut || '').toLowerCase().includes(q) ||
      abonneName(c.abonne_id).toLowerCase().includes(q)
    )
  })
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Contrats</h1>
          <p>{contrats.length} contrat(s) enregistré(s)</p>
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
          <div className="empty">Aucun contrat trouvé</div>
        ) : (
          <table className="table-contrats">
            <thead>
              <tr>
                <th>N°</th>
                <th>Numéro</th>
                <th>Abonné</th>
                <th>Type</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Statut</th>
                <th>Montant</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.numero_contrat}</td>
                  <td>{abonneName(c.abonne_id)}</td>
                  <td>{c.type_contrat}</td>
                  <td>{formatDate(c.date_debut)}</td>
                  <td>{formatDate(c.date_fin)}</td>
                  <td>
                    <span className={`badge ${statutBadge(c.statut)}`}>
                      {c.statut}
                    </span>
                  </td>
                  <td>{formatMoney(c.montant)}</td>
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
          title={editing ? 'Modifier un contrat' : 'Nouveau contrat'}
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
              <label>Numéro contrat *</label>
              <input
                name="numero_contrat"
                value={form.numero_contrat}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Abonné *</label>
              <select
                name="abonne_id"
                value={form.abonne_id}
                onChange={handleChange}
                required
              >
                <option value="">-- Sélectionner --</option>
                {abonnes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom} {a.prenom} ({a.numero_abonne})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Type de contrat</label>
              <input
                name="type_contrat"
                value={form.type_contrat}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Statut</label>
              <input
                name="statut"
                value={form.statut}
                onChange={handleChange}
                placeholder="Actif, Résilié..."
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
              <label>Montant</label>
              <input
                type="number"
                step="0.01"
                name="montant"
                value={form.montant}
                onChange={handleChange}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

