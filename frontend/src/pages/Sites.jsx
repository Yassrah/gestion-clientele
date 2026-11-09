import { useEffect, useRef, useState } from 'react'
import { siteService } from '../services/site.service'
import Pagination, { usePagination } from '../components/Pagination'
import Alert from '../components/Alert'
import { authService } from '../services/auth.service'
import Modal from '../components/Modal'
// Bibliothèques Excel chargées à la demande (pas dans le bundle principal)
const chargerExcel = () => import('../utils/importSites')

const emptyForm = {
  code: '',
  quartier: '',
  ville: '',
}

export default function Sites() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  // Gestion des sites réservée aux administrateurs
  const admin = authService.estAdmin()
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  // Import Excel : fichier choisi → aperçu (apercu) → confirmation
  const fichierRef = useRef(null)
  const [apercu, setApercu] = useState(null) // { nom, lignes }
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      setSites(await siteService.getAll())
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

  const openEdit = (s) => {
    setEditing(s)
    setForm({ code: s.code, quartier: s.quartier, ville: s.ville })
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
        await siteService.update(editing.id, form)
      } else {
        await siteService.create(form)
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
    if (!window.confirm('Supprimer ce site ?')) return
    try {
      await siteService.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleFichier = async (e) => {
    const fichier = e.target.files[0]
    e.target.value = '' // permet de rechoisir le même fichier après correction
    if (!fichier) return
    setError('')
    setSuccess('')
    const { lireSitesExcel } = await chargerExcel()
    const { lignes, erreur } = await lireSitesExcel(fichier)
    if (erreur) {
      setError(erreur)
      return
    }
    setApercu({ nom: fichier.name, lignes })
  }

  const handleImporter = async () => {
    setImporting(true)
    try {
      const { message } = await siteService.importer(
        apercu.lignes.map(({ ligne, code, quartier, ville }) => ({ ligne, code, quartier, ville }))
      )
      setApercu(null)
      setSuccess(message)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  // Statut de chaque ligne de l'aperçu : erreur, nouveau site ou mise à jour d'un site existant
  const parCode = new Map(sites.map((s) => [s.code, s]))
  const statutLigne = (l) => {
    if (l.erreur) return { label: l.erreur, cls: 'badge-red' }
    const existant = parCode.get(l.code)
    if (!existant) return { label: 'Nouveau', cls: 'badge-green' }
    if (existant.quartier === l.quartier && existant.ville === l.ville) return { label: 'Inchangé', cls: 'badge-blue' }
    return { label: `Mise à jour (${existant.quartier}, ${existant.ville})`, cls: 'badge-yellow' }
  }
  const nbErreurs = apercu ? apercu.lignes.filter((l) => l.erreur).length : 0

  // Un nombre filtre par référence (début du code), un texte par quartier ou ville
  const filtered = sites.filter((s) => {
    const q = search.trim().toLowerCase()
    if (/^\d+$/.test(q)) return s.code.startsWith(q)
    return s.quartier.toLowerCase().includes(q) || s.ville.toLowerCase().includes(q)
  })
  const pagination = usePagination(filtered, search)
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sites</h1>
          <p>{sites.length} site(s) — quartiers identifiés par une référence de site</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Réf. site, quartier ou ville..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {admin && (
            <>
              <button className="btn btn-secondary" onClick={() => fichierRef.current.click()}>
                Importer (Excel)
              </button>
              <input
                ref={fichierRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFichier}
                hidden
              />
              <button className="btn" onClick={openCreate}>
                + Ajouter
              </button>
            </>
          )}
        </div>
      </div>

      {admin && (
        <p className="form-hint" style={{ marginTop: '-0.75rem', marginBottom: '1rem' }}>
          Import : fichier .xlsx avec les colonnes « Réf. site », « Quartier », « Ville ».{' '}
          <button type="button" className="lien" onClick={async () => (await chargerExcel()).telechargerModeleSites()}>
            Télécharger le modèle Excel
          </button>
        </p>
      )}

      <Alert type="error" message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <div className="card table-wrapper">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">Aucun site trouvé</div>
        ) : (
          <>
            <table className="table-sites">
              <thead>
                <tr>
                  <th>Réf. site</th>
                  <th>Quartier</th>
                  <th>Ville</th>
                  <th>Abonnés</th>
                  {admin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="badge badge-blue badge-site">{s.code}</span>
                    </td>
                    <td>{s.quartier}</td>
                    <td>{s.ville}</td>
                    <td>{s.nb_abonnes}</td>
                    {admin && (
                      <td>
                        <div className="actions-cell">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>
                            Modifier
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(s.id)}
                            disabled={s.nb_abonnes > 0}
                            title={s.nb_abonnes > 0 ? 'Des abonnés sont rattachés à ce site' : undefined}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    )}
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
          title={editing ? 'Modifier un site' : 'Nouveau site'}
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Annuler
              </button>
              <button className="btn" type="submit" form="site-form" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <form id="site-form" className="form-grid" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Référence du site *</label>
              <input
                name="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
                inputMode="numeric"
                maxLength={10}
                placeholder="611"
                required
              />
              <small className="form-hint">Chiffres uniquement ; le 1er chiffre regroupe une ville</small>
            </div>
            <div className="form-group">
              <label>Quartier *</label>
              <input
                name="quartier"
                value={form.quartier}
                onChange={handleChange}
                placeholder="Besakoa"
                required
              />
            </div>
            <div className="form-group full">
              <label>Ville *</label>
              <input
                name="ville"
                value={form.ville}
                onChange={handleChange}
                placeholder="Toliara"
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {apercu && (
        <Modal
          title={`Importer des sites — ${apercu.nom}`}
          onClose={() => setApercu(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setApercu(null)}>
                Annuler
              </button>
              <button className="btn" onClick={handleImporter} disabled={importing || nbErreurs > 0}>
                {importing ? 'Import...' : `Importer ${apercu.lignes.length} site(s)`}
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
            {nbErreurs > 0
              ? `${nbErreurs} ligne(s) en erreur : corrigez le fichier puis réimportez-le (rien n'est importé tant qu'il reste une erreur).`
              : "Vérifiez l'aperçu : les codes existants seront mis à jour, les autres créés. Les abonnés rattachés sont conservés."}
          </p>
          <div className="table-wrapper import-apercu">
            <table>
              <thead>
                <tr>
                  <th>Ligne</th>
                  <th>Réf. site</th>
                  <th>Quartier</th>
                  <th>Ville</th>
                  <th>Résultat</th>
                </tr>
              </thead>
              <tbody>
                {apercu.lignes.map((l) => {
                  const statut = statutLigne(l)
                  return (
                    <tr key={l.ligne}>
                      <td>{l.ligne}</td>
                      <td>{l.code || '—'}</td>
                      <td>{l.quartier || '—'}</td>
                      <td>{l.ville || '—'}</td>
                      <td>
                        <span className={`badge ${statut.cls}`}>{statut.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  )
}
