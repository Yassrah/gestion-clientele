import { useEffect, useState } from 'react'
import { abonneService } from '../services/abonne.service'
import Alert from '../components/Alert'
import Modal from '../components/Modal'

const emptyForm = {
  numero_abonne: '',
  nom: '',
  prenom: '',
  adresse: '',
  telephone: '',
  email: '',
}

export default function Abonnes() {
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
      setAbonnes(await abonneService.getAll())
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

  const openEdit = (a) => {
    setEditing(a)
    setForm({
      numero_abonne: a.numero_abonne || '',
      nom: a.nom || '',
      prenom: a.prenom || '',
      adresse: a.adresse || '',
      telephone: a.telephone || '',
      email: a.email || '',
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
    const q = search.toLowerCase()
    return (
      (a.nom || '').toLowerCase().includes(q) ||
      (a.prenom || '').toLowerCase().includes(q) ||
      (a.numero_abonne || '').toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q)
    )
  })
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Abonnés</h1>
          <p>{abonnes.length} abonné(s) enregistré(s)</p>
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
          <div className="empty">Aucun abonné trouvé</div>
        ) : (
          <table className="table-abonnes">
            <thead>
              <tr>
                <th>N°</th>
                <th>Numéro</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Adresse</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>{a.id}</td>
                  <td>{a.numero_abonne}</td>
                  <td>{a.nom}</td>
                  <td>{a.prenom}</td>
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
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(a.id)}
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
              <button className="btn" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Numéro abonné *</label>
              <input
                name="numero_abonne"
                value={form.numero_abonne}
                onChange={handleChange}
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
                name="telephone"
                value={form.telephone}
                onChange={handleChange}
              />
            </div>
            <div className="form-group full">
              <label>Adresse</label>
              <input
                name="adresse"
                value={form.adresse}
                onChange={handleChange}
              />
            </div>
            <div className="form-group full">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

