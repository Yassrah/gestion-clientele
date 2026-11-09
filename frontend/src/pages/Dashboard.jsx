import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import 'chart.js/auto'
import { statsService } from '../services/stats.service'
import Alert from '../components/Alert'
import { formatNombre } from '../utils/format'
import {
  IconAbonnes,
  IconContrats,
  IconCompteurs,
  IconReleves,
} from '../components/Icons'

// Tableau de bord, d'après le « Guide des statistiques et des graphiques » JIRAMA :
// 4 cartes, puis relevés / contrats par type, consommation / état des contrats,
// et en complément compteurs par service / nouveaux abonnés. Données : GET /api/stats.

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const MOIS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août',
  'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Couleurs validées (validate_palette.js, fond clair) : eau/électricité séparables
// en vision normale et pour les daltoniens, contraste ≥ 3:1. Mêmes teintes que la palette JIRAMA.
const EAU = '#1d71b8'
const ELEC = '#d9730d'
// Statuts : réservés à l'état des contrats, toujours affichés avec leur libellé
const STATUTS = { Actif: '#15803d', Suspendu: '#ca8a04', Résilié: '#b91c1c' }
const GRILLE = '#e2e8f0'
const TEXTE = '#64748b'

const SERVICES = {
  eau: { label: 'Eau', couleur: EAU, unite: 'm³' },
  electricite: { label: 'Électricité', couleur: ELEC, unite: 'kWh' },
}

const toutZero = (valeurs) => valeurs.every((v) => !v)

// Options communes : marques fines, grille discrète, info-bulle sur tout le mois survolé
const optionsAxes = (titreY, { entier = false, legende = false } = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      display: legende,
      position: 'top',
      align: 'end',
      labels: { usePointStyle: true, boxWidth: 8, color: TEXTE },
    },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label} : ${formatNombre(ctx.parsed.y ?? ctx.parsed.x)}`,
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: TEXTE, maxRotation: 0, autoSkip: true } },
    y: {
      beginAtZero: true,
      grid: { color: GRILLE },
      border: { display: false },
      ticks: { color: TEXTE, precision: entier ? 0 : undefined },
      title: { display: true, text: titreY, color: TEXTE },
    },
  },
})

const serieLigne = (label, data, couleur) => ({
  label,
  data,
  borderColor: couleur,
  backgroundColor: couleur,
  borderWidth: 2,
  pointRadius: 4,
  pointHoverRadius: 6,
  pointBorderColor: '#fff',
  pointBorderWidth: 2,
  // Monotone : courbe adoucie sans jamais dépasser les valeurs réelles
  cubicInterpolationMode: 'monotone',
})

// Mois pas encore écoulés de l'année en cours : vides (null) plutôt qu'à 0
const sansFutur = (valeurs, annee) => {
  const maintenant = new Date()
  if (annee !== maintenant.getFullYear()) return valeurs
  return valeurs.map((v, i) => (i > maintenant.getMonth() ? null : v))
}

const serieBarre = (label, data, couleur) => ({
  label,
  data,
  backgroundColor: couleur,
  borderRadius: 4,
  borderSkipped: 'start',
  maxBarThickness: 28,
})

// Carte de graphique : titre, unité, et message explicite si aucune donnée
function CarteGraphique({ titre, sousTitre, vide, children }) {
  return (
    <section className="chart-card">
      <header className="chart-card-head">
        <h3>{titre}</h3>
        {sousTitre && <span className="chart-card-sub">{sousTitre}</span>}
      </header>
      <div className="chart-canvas">
        {vide ? <p className="chart-empty">Aucune donnée pour cette période</p> : children}
      </div>
    </section>
  )
}

// Anneau + légende chiffrée (libellé, valeur, %) : l'identité ne repose jamais sur la couleur seule
function Anneau({ libelles, valeurs, couleurs }) {
  const total = valeurs.reduce((s, v) => s + v, 0)
  return (
    <div className="anneau">
      <div className="anneau-graphique">
        <Doughnut
          data={{
            labels: libelles,
            datasets: [{ data: valeurs, backgroundColor: couleurs, borderColor: '#fff', borderWidth: 2 }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: { legend: { display: false } },
          }}
        />
        <div className="anneau-total">
          <strong>{formatNombre(total)}</strong>
          <span>au total</span>
        </div>
      </div>
      <ul className="anneau-legende">
        {libelles.map((l, i) => (
          <li key={l}>
            <span className="pastille" style={{ background: couleurs[i] }} />
            <span className="anneau-libelle">{l}</span>
            <strong>{formatNombre(valeurs[i])}</strong>
            <span className="anneau-pct">{total ? Math.round((valeurs[i] / total) * 100) : 0} %</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Dashboard() {
  const [filtres, setFiltres] = useState({ annee: '', mois: '', service: '' })
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Recalcul à chaque changement de filtre (et à chaque arrivée sur la page)
  useEffect(() => {
    let actif = true
    setLoading(true)
    statsService
      .get(filtres)
      .then((s) => actif && (setStats(s), setError('')))
      .catch((err) => actif && setError(err.message))
      .finally(() => actif && setLoading(false))
    return () => {
      actif = false
    }
  }, [filtres])

  const changer = (cle) => (e) => setFiltres({ ...filtres, [cle]: e.target.value })

  if (!stats) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Tableau de bord</h1>
          </div>
        </div>
        <Alert type="error" message={error} />
        {loading && <div className="loading">Chargement des statistiques...</div>}
      </div>
    )
  }

  const { cartes, filtres: f } = stats
  const periode = f.mois ? `${MOIS_LONG[f.mois - 1]} ${f.annee}` : `${f.annee}`
  const services = f.service ? [f.service] : ['eau', 'electricite']

  const cartesStats = [
    {
      label: 'Abonnés',
      value: cartes.abonnes,
      detail: `+${formatNombre(cartes.nouveaux_abonnes)} nouveau(x) en ${periode}`,
      to: '/abonnes',
      Icon: IconAbonnes,
    },
    {
      label: 'Contrats',
      value: cartes.contrats,
      detail: `${formatNombre(cartes.contrats_actifs)} actif(s)`,
      to: '/contrats',
      Icon: IconContrats,
    },
    {
      label: 'Compteurs',
      value: cartes.compteurs,
      detail: `${stats.compteurs_par_service.eau} eau · ${stats.compteurs_par_service.electricite} électricité`,
      to: '/compteurs',
      Icon: IconCompteurs,
    },
    {
      label: 'Relevés',
      value: cartes.releves,
      detail: `en ${periode}${f.service ? ` · ${SERVICES[f.service].label.toLowerCase()}` : ''}`,
      to: '/releves',
      Icon: IconReleves,
    },
  ]

  // Ligne 2 : relevés par mois (une courbe par service)
  const relevesVide = services.every((s) => toutZero(stats.releves_par_mois[s]))
  const donneesReleves = {
    labels: MOIS,
    datasets: services.map((s) =>
      serieLigne(SERVICES[s].label, sansFutur(stats.releves_par_mois[s], f.annee), SERVICES[s].couleur)
    ),
  }

  // Contrats par type : barres horizontales triées (6 catégories se lisent mieux qu'en camembert)
  const types = stats.contrats_par_type
  const donneesTypes = {
    labels: types.map((t) => t.type),
    datasets: [serieBarre('Contrats', types.map((t) => t.n), EAU)],
  }
  const optionsTypes = {
    ...optionsAxes('', { entier: true }),
    indexAxis: 'y',
    interaction: { mode: 'nearest', intersect: true },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: GRILLE },
        border: { display: false },
        ticks: { color: TEXTE, precision: 0 },
        title: { display: true, text: 'Nombre de contrats', color: TEXTE },
      },
      y: { grid: { display: false }, ticks: { color: TEXTE } },
    },
  }

  // Ligne 3 : consommation — un graphique par unité (jamais m³ et kWh sur le même axe)
  const graphiqueConso = (s) => (
    <CarteGraphique
      key={s}
      titre={`Consommation d'${s === 'eau' ? 'eau' : 'électricité'}`}
      sousTitre={`${SERVICES[s].unite} par mois · ${f.annee}`}
      vide={toutZero(stats.consommation_par_mois[s])}
    >
      <Bar
        data={{
          labels: MOIS,
          datasets: [serieBarre(`${SERVICES[s].label} (${SERVICES[s].unite})`, sansFutur(stats.consommation_par_mois[s], f.annee), SERVICES[s].couleur)],
        }}
        options={optionsAxes(SERVICES[s].unite)}
      />
    </CarteGraphique>
  )

  const statuts = stats.contrats_par_statut
  const compteurs = stats.compteurs_par_service

  return (
    <div className={loading ? 'dashboard en-cours' : 'dashboard'}>
      <div className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>Situation de la clientèle — {periode}</p>
        </div>
        {/* Filtres : une seule ligne, au-dessus des graphiques */}
        <div className="dashboard-filtres">
          <label>
            Année
            <select value={filtres.annee || f.annee} onChange={changer('annee')}>
              {f.annees.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Mois
            <select value={filtres.mois} onChange={changer('mois')}>
              <option value="">Toute l'année</option>
              {MOIS_LONG.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Service
            <select value={filtres.service} onChange={changer('service')}>
              <option value="">Eau et électricité</option>
              <option value="eau">Eau</option>
              <option value="electricite">Électricité</option>
            </select>
          </label>
        </div>
      </div>

      <Alert type="error" message={error} onClose={() => setError('')} />

      {/* Ligne 1 : cartes */}
      <div className="stats-grid">
        {cartesStats.map((c) => (
          <Link key={c.label} to={c.to} className="stat-card">
            <div className="stat-icon">
              <c.Icon size={26} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{formatNombre(c.value)}</div>
              <div className="stat-label">{c.label}</div>
              <div className="stat-detail">{c.detail}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Ligne 2 */}
      <div className="charts-row">
        <CarteGraphique titre="Évolution des relevés par mois" sousTitre={`Nombre de relevés · ${f.annee}`} vide={relevesVide}>
          <Line data={donneesReleves} options={optionsAxes('Nombre de relevés', { entier: true, legende: services.length > 1 })} />
        </CarteGraphique>
        <CarteGraphique titre="Répartition des contrats par type" sousTitre="Tous les contrats" vide={types.length === 0}>
          <Bar data={donneesTypes} options={optionsTypes} />
        </CarteGraphique>
      </div>

      {/* Ligne 3 */}
      <div className={`charts-row ${services.length > 1 ? 'charts-row-3' : ''}`}>
        {services.map(graphiqueConso)}
        <CarteGraphique titre="État des contrats" sousTitre="Actifs, suspendus et résiliés" vide={toutZero(statuts.map((s) => s.n))}>
          <Anneau
            libelles={statuts.map((s) => s.statut)}
            valeurs={statuts.map((s) => s.n)}
            couleurs={statuts.map((s) => STATUTS[s.statut])}
          />
        </CarteGraphique>
      </div>

      {/* Compléments */}
      <div className="charts-row">
        <CarteGraphique titre="Répartition des compteurs" sousTitre="Eau et électricité" vide={!compteurs.eau && !compteurs.electricite}>
          <Anneau
            libelles={['Eau', 'Électricité']}
            valeurs={[compteurs.eau, compteurs.electricite]}
            couleurs={[EAU, ELEC]}
          />
        </CarteGraphique>
        <CarteGraphique
          titre="Nouveaux abonnés par mois"
          sousTitre={`Abonnés créés · ${f.annee}`}
          vide={toutZero(stats.nouveaux_abonnes_par_mois)}
        >
          <Bar
            data={{ labels: MOIS, datasets: [serieBarre('Nouveaux abonnés', sansFutur(stats.nouveaux_abonnes_par_mois, f.annee), EAU)] }}
            options={optionsAxes('Nombre d\'abonnés', { entier: true })}
          />
        </CarteGraphique>
      </div>
    </div>
  )
}
