import { useEffect, useState } from 'react'
import { releveService } from '../services/releve.service'
import { contratService } from '../services/contrat.service'
import { compteurService } from '../services/compteur.service'
import Alert from '../components/Alert'
import Modal from '../components/Modal'
import { formatDate } from '../utils/format'

const emptyForm = {
  contrat_id: '',
  compteur_id: '',
  date_releve: '',
  ancien_index: '',
  nouvel_index: '',
}

export default function Releves() {
  const [releves, setReleves] = useState([])
  const [contrats, setContrats] = useState([])
  const [compteurs, setCompteurs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Recherche par abonné
  const [nom, setNom] = useState('')
  const [relevesAbonne, setRelevesAbonne] = useState(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const [r, c, cp] = await Promise.all([
        releveService.getAll(),
        contratService.getAll(),
        compteurService.getAll(),
      ])
      setReleves(r)
      setContrats(c)
      setCompteurs(cp)
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

  const openEdit = (r) => {
    setEditing(r)
    setForm({
      contrat_id: r.contrat_id || '',
      compteur_id: r.compteur_id || '',
      date_releve: r.date_releve ? String(r.date_releve).slice(0, 10) : '',
      ancien_index: r.ancien_index ?? '',
      nouvel_index: r.nouvel_index ?? '',
    })
    setError('')
    setShowModal(true)
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const consommation = () => {
    const a = Number(form.ancien_index)
    const n = Number(form.nouvel_index)
    if (isNaN(a) || isNaN(n)) return 0
    return n - a
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await releveService.update(editing.id, form)
      } else {
        await releveService.create(form)
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
    if (!window.confirm('Supprimer ce relevé ?')) return
    try {
      await releveService.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSearchAbonne = async (e) => {
    e.preventDefault()
    if (!nom.trim()) return
    setSearching(true)
    setError('')
    try {
      setRelevesAbonne(await releveService.getByAbonne(nom.trim()))
    } catch (err) {
      setError(err.message)
      setRelevesAbonne([])
    } finally {
      setSearching(false)
    }
  }
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Relevés</h1>
          <p>{releves.length} relevé(s) enregistré(s)</p>
        </div>
        <button className="btn" onClick={openCreate}>
          + Ajouter
        </button>
      </div>

      <Alert type="error" message={error} onClose={() => setError('')} />

      {/* Recherche des relevés d'un abonné par nom */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearchAbonne} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label>Rechercher les relevés par nom d'abonné</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: Dupont"
            />
          </div>
          <button className="btn" disabled={searching}>
            {searching ? 'Recherche...' : 'Rechercher'}
          </button>
          {relevesAbonne && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRelevesAbonne(null)}
            >
              Effacer
            </button>
          )}
        </form>

        {relevesAbonne && (
          <div style={{ marginTop: '1rem' }}>
            {relevesAbonne.length === 0 ? (
              <div className="empty">Aucun relevé pour cet abonné</div>
            ) : (
              <div className="table-wrapper">
                <table className="table-releves">
                  <thead>
                    <tr>
                      <th>Abonné</th>
                      <th>Compteur</th>
                      <th>Type</th>
                      <th>Tarif</th>
                      <th>Date</th>
                      <th>Ancien</th>
                      <th>Nouvel</th>
                      <th>Conso.</th>
                      <th>Prix unit.</th>
                      <th>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relevesAbonne.map((r, i) => (
                      <tr key={i}>
                        <td>{r.prenom} {r.nom}</td>
                        <td>{r.numero_compteur}</td>
                        <td>{r.type}</td>
                        <td>{r.tarif}</td>
                        <td>{formatDate(r.date_releve)}</td>
                        <td>{r.ancien_index}</td>
                        <td>{r.nouvel_index}</td>
                        <td>{r.consommation}</td>
                        <td>{Number(r.prix_unitaire).toFixed(2)}</td>
                        <td className="facture-total">{Number(r.montant).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>


      <div className="card table-wrapper">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : releves.length === 0 ? (
          <div className="empty">Aucun relevé trouvé</div>
        ) : (
          <table className="table-releves">
            <thead>
              <tr>
                <th>N°</th>
                <th>Contrat</th>
                <th>Date relevé</th>
                <th>Ancien index</th>
                <th>Nouvel index</th>
                <th>Consommation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {releves.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.contrat_id ? `#${r.contrat_id}` : '—'}</td>
                  <td>{formatDate(r.date_releve)}</td>
                  <td>{r.ancien_index}</td>
                  <td>{r.nouvel_index}</td>
                  <td>{r.consommation}</td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(r)}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(r.id)}
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
          title={editing ? 'Modifier un relevé' : 'Nouveau relevé'}
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
            <div className="form-group">
              <label>Compteur</label>
              <select
                name="compteur_id"
                value={form.compteur_id}
                onChange={handleChange}
              >
                <option value="">-- Sélectionner --</option>
                {compteurs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero_compteur}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date relevé</label>
              <input
                type="date"
                name="date_releve"
                value={form.date_releve}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Consommation calculée</label>
              <input value={consommation()} readOnly disabled />
            </div>
            <div className="form-group">
              <label>Ancien index *</label>
              <input
                type="number"
                name="ancien_index"
                value={form.ancien_index}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Nouvel index *</label>
              <input
                type="number"
                name="nouvel_index"
                value={form.nouvel_index}
                onChange={handleChange}
                required
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

