import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { abonneService } from '../services/abonne.service'
import { contratService } from '../services/contrat.service'
import { compteurService } from '../services/compteur.service'
import { releveService } from '../services/releve.service'
import { tarifService } from '../services/tarif.service'
import { Line, Pie } from 'react-chartjs-2'
import 'chart.js/auto'
import {
  IconAbonnes,
  IconContrats,
  IconCompteurs,
  IconReleves,
  IconTarifs,
} from '../components/Icons'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

// Teintes de la palette JIRAMA (voir :root dans index.css) : bleu et orange, du foncé au clair
const BLEU = '#1d71b8'
const COULEURS = [BLEU, '#f39c1f', '#13548c', '#9a5b05', '#7fb0de', '#f8c77e']

// Nombre de relevés par mois sur les 12 derniers mois (mois courant inclus)
function relevesParMois(releves) {
  const now = new Date()
  const mois = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    return { annee: d.getFullYear(), mois: d.getMonth(), total: 0 }
  })
  releves.forEach((r) => {
    const d = new Date(r.date_releve)
    const m = mois.find((x) => x.annee === d.getFullYear() && x.mois === d.getMonth())
    if (m) m.total++
  })
  return {
    labels: mois.map((m) => `${MOIS[m.mois]} ${String(m.annee).slice(2)}`),
    data: mois.map((m) => m.total),
  }
}

// Nombre de contrats par type de contrat
function contratsParType(contrats) {
  const counts = {}
  contrats.forEach((c) => {
    const type = c.type_contrat || 'Non défini'
    counts[type] = (counts[type] || 0) + 1
  })
  return { labels: Object.keys(counts), data: Object.values(counts) }
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    abonnes: 0,
    contrats: 0,
    compteurs: 0,
    releves: 0,
    tarifs: 0,
  })
  const [releveList, setReleveList] = useState([])
  const [contratList, setContratList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const [abonnes, contrats, compteurs, releves, tarifs] = await Promise.all([
        abonneService.getAll(),
        contratService.getAll(),
        compteurService.getAll(),
        releveService.getAll(),
        tarifService.getAll(),
      ])
      setStats({
        abonnes: abonnes.length,
        contrats: contrats.length,
        compteurs: compteurs.length,
        releves: releves.length,
        tarifs: tarifs.length,
      })
      setReleveList(releves)
      setContratList(contrats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Chargement...</div>

  // Cartes de statistiques
  const cards = [
    { label: 'Abonnés', value: stats.abonnes, to: '/abonnes', Icon: IconAbonnes },
    { label: 'Contrats', value: stats.contrats, to: '/contrats', Icon: IconContrats },
    { label: 'Compteurs', value: stats.compteurs, to: '/compteurs', Icon: IconCompteurs },
    { label: 'Relevés', value: stats.releves, to: '/releves', Icon: IconReleves },
    { label: 'Tarifs', value: stats.tarifs, to: '/tarifs', Icon: IconTarifs },
  ]
  
  // Données pour le graphique en lignes (évolution des relevés par mois)
  const parMois = relevesParMois(releveList)
  const lineChartData = {
    labels: parMois.labels,
    datasets: [
      {
        label: 'Relevés/mois',
        data: parMois.data,
        borderColor: BLEU,
        backgroundColor: 'rgba(29, 113, 184, 0.1)',
        pointBackgroundColor: BLEU,
        tension: 0.4,
        fill: true,
      },
    ],
  }

  // Données pour le graphique en camembert (répartition par type de contrat)
  const parType = contratsParType(contratList)
  const pieChartData = {
    labels: parType.labels,
    datasets: [
      {
        data: parType.data,
        backgroundColor: parType.labels.map((_, i) => COULEURS[i % COULEURS.length]),
      },
    ],
  }

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  }
  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <p>Vue d'ensemble de votre gestion de clientèle</p>
        </div>
      </div>

      <div className="stats-grid">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="stat-card">
            <div className="stat-icon">
              <c.Icon size={26} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="welcome-card">
        <h2>Bienvenue</h2>
        <p>
          Utilisez le menu de gauche pour gérer les abonnés, contrats, compteurs,
          relevés et tarifs. Chaque section vous permet d'ajouter, modifier et
          supprimer des éléments en toute simplicité.
        </p>
        <span className="welcome-tip">
          Astuce : assurez-vous que le backend est démarré sur le port 5000.
        </span>
      </div>

      {/* Section des charts */}
      <div className="charts-section">
        <h2>Statistiques clés</h2>
        <div className="charts-row">
          <div className="line-chart-wrapper">
            <div className="chart-canvas">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
            <p className="chart-label">Évolution des relevés (par mois)</p>
          </div>
          <div className="pie-chart-wrapper">
            <div className="chart-canvas">
              {parType.data.length > 0 ? (
                <Pie data={pieChartData} options={pieChartOptions} />
              ) : (
                <p className="chart-empty">Aucun contrat enregistré</p>
              )}
            </div>
            <p className="chart-label">Répartition des contrats</p>
          </div>
        </div>
      </div>
    </div>
  )
}
