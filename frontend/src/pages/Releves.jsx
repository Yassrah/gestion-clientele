import { useEffect, useMemo, useState } from 'react'
import { useImpressionFacture } from '../hooks/useImpressionFacture'
import { releveService } from '../services/releve.service'
import { contratService } from '../services/contrat.service'
import { compteurService } from '../services/compteur.service'
import Pagination, { usePagination } from '../components/Pagination'
import Alert from '../components/Alert'
import FiltreSite, { correspondSite } from '../components/FiltreSite'
import { authService } from '../services/auth.service'
import Modal from '../components/Modal'
import { formatDate, formatMoney, formatNombre, toInputDate } from '../utils/format'

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
  // Suppressions (et gestion des tarifs) réservées aux administrateurs
  const admin = authService.estAdmin()
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const impression = useImpressionFacture()

  // Recherche par abonné
  const [nom, setNom] = useState('')
  const [filtreSite, setFiltreSite] = useState('')
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
      date_releve: toInputDate(r.date_releve),
      ancien_index: r.ancien_index ?? '',
      nouvel_index: r.nouvel_index ?? '',
    })
    setError('')
    setShowModal(true)
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  // Changer de contrat retire un compteur qui n'en fait pas partie
  const handleContratChange = (e) => {
    const compteur = compteurs.find((c) => String(c.id) === String(form.compteur_id))
    const garde = compteur && String(compteur.contrat_id) === e.target.value
    setForm({
      ...form,
      contrat_id: e.target.value,
      compteur_id: garde ? form.compteur_id : '',
    })
  }

  // Le choix d'un compteur renseigne son contrat
  const handleCompteurChange = (e) => {
    const compteur = compteurs.find((c) => String(c.id) === e.target.value)
    setForm({
      ...form,
      compteur_id: e.target.value,
      contrat_id: compteur?.contrat_id ? String(compteur.contrat_id) : form.contrat_id,
    })
  }

  // Nouveau relevé : seulement les contrats actifs et les compteurs en service (règle du serveur)
  const estActif = (statut) => !statut || statut === 'Actif'
  const contratsProposes = editing ? contrats : contrats.filter((c) => estActif(c.statut))
  const compteursProposes = editing ? compteurs : compteurs.filter((c) => estActif(c.statut))

  // Compteurs proposés : ceux du contrat sélectionné
  const compteursDuContrat = form.contrat_id
    ? compteursProposes.filter((c) => String(c.contrat_id) === String(form.contrat_id))
    : compteursProposes

  // Relevé précédent du même compteur (même ordre que le serveur : date puis id).
  // Son nouvel index devient l'ancien index de ce relevé ; s'il n'existe pas,
  // c'est le premier relevé du compteur et l'ancien index est saisi.
  const precedent = useMemo(() => {
    if (!form.compteur_id) return null
    const date = form.date_releve || '9999-12-31'
    const id = editing ? editing.id : Infinity
    const avant = releves
      .filter((r) => String(r.compteur_id) === String(form.compteur_id) && r.id !== editing?.id)
      .map((r) => ({ ...r, jour: toInputDate(r.date_releve) }))
      .filter((r) => r.jour < date || (r.jour === date && r.id < id))
      .sort((a, b) => (a.jour === b.jour ? a.id - b.id : a.jour < b.jour ? -1 : 1))
    return avant[avant.length - 1] || null
  }, [releves, form.compteur_id, form.date_releve, editing])

  const ancienIndex = precedent ? precedent.nouvel_index : form.ancien_index

  const consommation = () => {
    if (ancienIndex === '' || form.nouvel_index === '') return 0
    const a = Number(ancienIndex)
    const n = Number(form.nouvel_index)
    if (isNaN(a) || isNaN(n)) return 0
    return n - a
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = { ...form, ancien_index: ancienIndex }
      const saved = editing
        ? await releveService.update(editing.id, data)
        : await releveService.create(data)
      // La facture est générée automatiquement par le serveur
      setNotice(
        saved.facture
          ? `Relevé ajouté à la facture ${saved.facture.numero} du mois — total : ${formatMoney(saved.facture.total)} Ar`
          : 'Relevé enregistré, mais aucune facture générée : le compteur n\'a pas de tarif'
      )
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
  const paginationAbonne = usePagination(relevesAbonne || [], relevesAbonne)
  const relevesDuSite = releves.filter((r) => correspondSite(r, filtreSite))
  const pagination = usePagination(relevesDuSite, releves.length + '|' + filtreSite)
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Relevés</h1>
          <p>
            {filtreSite ? `${relevesDuSite.length} relevé(s) pour le site ${filtreSite}…` : `${releves.length} relevé(s) enregistré(s)`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <FiltreSite value={filtreSite} onChange={setFiltreSite} />
          <button className="btn" onClick={openCreate}>
            + Ajouter
          </button>
        </div>
      </div>

      <Alert type="error" message={error} onClose={() => setError('')} />
      <Alert
        type="error"
        message={impression.erreur}
        onClose={() => impression.setErreur('')}
      />
      {impression.zoneImpression}
      <Alert type="success" message={notice} onClose={() => setNotice('')} />

      {/* Recherche des relevés d'un abonné par nom */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearchAbonne} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label>Rechercher les relevés d'un abonné (nom, prénom ou n° d'abonné)</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Rakoto, Hery, AB0001"
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
              <div className="empty">Aucun relevé trouvé pour « {nom} »</div>
            ) : (
              <div className="table-wrapper">
                <>
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
                      {paginationAbonne.pageItems.map((r, i) => (
                        <tr key={i}>
                          <td>{r.prenom} {r.nom}</td>
                          <td>{r.numero_compteur}</td>
                          <td>{r.type}</td>
                          <td>{r.tarif}</td>
                          <td>{formatDate(r.date_releve)}</td>
                          <td className="cell-num">{formatNombre(r.ancien_index)}</td>
                          <td className="cell-num">{formatNombre(r.nouvel_index)}</td>
                          <td className="cell-num">{formatNombre(r.consommation)}</td>
                          <td className="cell-num">{formatMoney(r.prix_unitaire)}</td>
                          <td className="cell-num facture-total">{formatMoney(r.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination pagination={paginationAbonne} />
                </>
              </div>
            )}
          </div>
        )}
      </div>


      <div className="card table-wrapper">
        {loading ? (
          <div className="loading">Chargement...</div>
        ) : relevesDuSite.length === 0 ? (
          <div className="empty">Aucun relevé trouvé</div>
        ) : (
          <>
            <table className="table-releves">
              <thead>
                <tr>
                  <th>Date relevé</th>
                  <th>Abonné</th>
                  <th>Contrat</th>
                  <th>Compteur</th>
                  <th>Ancien index</th>
                  <th>Nouvel index</th>
                  <th>Consommation</th>
                  <th>Facture</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date_releve)}</td>
                    <td>
                      {r.prenom} {r.nom}
                      <div className="cell-sub">{r.numero_abonne} · site {r.site_code || '—'}</div>
                    </td>
                    <td>{r.numero_contrat}</td>
                    <td>
                      {r.numero_compteur || '—'}
                      <div className="cell-sub">{r.type_compteur}</div>
                    </td>
                    <td className="cell-num">{formatNombre(r.ancien_index)}</td>
                    <td className="cell-num">{formatNombre(r.nouvel_index)}</td>
                    <td className="cell-num">
                      <strong>{formatNombre(r.consommation)}</strong>{' '}
                      {(r.type_compteur || '').toLowerCase().includes('eau') ? 'm³' : 'kWh'}
                    </td>
                    <td>
                      {r.statut_facture ? (
                        <span className={`badge ${r.statut_facture === 'payee' ? 'badge-green' : 'badge-yellow'}`}>
                          {r.statut_facture === 'payee' ? 'Payée' : 'Impayée'}
                        </span>
                      ) : (
                        <span className="badge badge-red">Non facturé</span>
                      )}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="btn btn-sm"
                          onClick={() => impression.imprimer(r.id)}
                          disabled={impression.enCours('releve', r.id)}
                        >
                          {impression.enCours('releve', r.id) ? 'Préparation...' : 'Imprimer'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(r)}
                        >
                          Modifier
                        </button>
                        {admin && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(r.id)}
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
              <button className="btn" type="submit" form="releve-form" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </>
          }
        >
          {error && <Alert type="error" message={error} />}
          <form id="releve-form" className="form-grid" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Contrat *</label>
              <select
                name="contrat_id"
                value={form.contrat_id}
                onChange={handleContratChange}
                required
              >
                <option value="">-- Sélectionner --</option>
                {contratsProposes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero_contrat}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Compteur *</label>
              <select
                name="compteur_id"
                value={form.compteur_id}
                onChange={handleCompteurChange}
                required
              >
                <option value="">-- Sélectionner --</option>
                {compteursDuContrat.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero_compteur}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date relevé *</label>
              <input
                type="date"
                name="date_releve"
                value={form.date_releve}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Consommation calculée</label>
              <input value={consommation()} readOnly disabled />
            </div>
            <div className="form-group">
              <label>Ancien index *</label>
              {precedent ? (
                <>
                  <input type="number" value={ancienIndex} readOnly disabled />
                  <small className="form-hint">
                    Nouvel index du relevé du {formatDate(precedent.date_releve)}
                  </small>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    name="ancien_index"
                    value={form.ancien_index}
                    onChange={handleChange}
                    disabled={!form.compteur_id}
                    required
                  />
                  <small className="form-hint">
                    {form.compteur_id
                      ? 'Premier relevé de ce compteur : saisir l\'index de départ'
                      : 'Sélectionnez d\'abord un compteur'}
                  </small>
                </>
              )}
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

