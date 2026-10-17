import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { abonneService } from '../services/abonne.service'
import { contratService } from '../services/contrat.service'
import { compteurService } from '../services/compteur.service'
import { releveService } from '../services/releve.service'
import { tarifService } from '../services/tarif.service'

export default function Dashboard() {
  const [stats, setStats] = useState({
    abonnes: 0,
    contrats: 0,
    compteurs: 0,
    releves: 0,
    tarifs: 0,
  })
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
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Chargement...</div>

  const cards = [
    { label: 'Abonnés', value: stats.abonnes, to: '/abonnes', icon: '👥', cls: 'stat-abonnes' },
    { label: 'Contrats', value: stats.contrats, to: '/contrats', icon: '📄', cls: 'stat-contrats' },
    { label: 'Compteurs', value: stats.compteurs, to: '/compteurs', icon: '🔢', cls: 'stat-compteurs' },
    { label: 'Relevés', value: stats.releves, to: '/releves', icon: '📊', cls: 'stat-releves' },
    { label: 'Tarifs', value: stats.tarifs, to: '/tarifs', icon: '💰', cls: 'stat-tarifs' },
  ]

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
          <Link key={c.label} to={c.to} className={`stat-card ${c.cls}`}>
            <div className="stat-icon">{c.icon}</div>
            <div className="stat-info">
              <div className="stat-value">{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="welcome-card">
        <h2>Bienvenue 👋</h2>
        <p>
          Utilisez le menu de gauche pour gérer les abonnés, contrats, compteurs,
          relevés et tarifs. Chaque section vous permet d'ajouter, modifier et
          supprimer des éléments en toute simplicité.
        </p>
        <span className="welcome-tip">
          💡 Astuce : assurez-vous que le backend est démarré sur le port 5000.
        </span>
      </div>
    </div>
  )
}
