import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { authService } from '../services/auth.service'
import { reclamationService } from '../services/reclamation.service'
import {
  IconDashboard,
  IconAbonnes,
  IconSites,
  IconContrats,
  IconCompteurs,
  IconReleves,
  IconFactures,
  IconTarifs,
  IconReclamations,
  IconUtilisateur,
  IconDeconnexion,
} from './Icons'

const links = [
  { to: '/', label: 'Tableau de bord', end: true, Icon: IconDashboard },
  { to: '/sites', label: 'Sites', Icon: IconSites },
  { to: '/abonnes', label: 'Abonnés', Icon: IconAbonnes },
  { to: '/contrats', label: 'Contrats', Icon: IconContrats },
  { to: '/compteurs', label: 'Compteurs', Icon: IconCompteurs },
  { to: '/releves', label: 'Relevés', Icon: IconReleves },
  { to: '/factures', label: 'Factures', Icon: IconFactures },
  { to: '/reclamations', label: 'Réclamations', Icon: IconReclamations, pastille: 'reclamations' },
  { to: '/tarifs', label: 'Tarifs', Icon: IconTarifs },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(authService.getUser())
  const [pastilles, setPastilles] = useState({})

  // Rôle à jour (sessions ouvertes avant l'ajout des rôles, ou rôle modifié depuis)
  useEffect(() => {
    authService.rafraichir().then(setUser).catch(() => {})
  }, [])

  // Pastille « réclamations non résolues » : à chaque page et après chaque action (événement)
  useEffect(() => {
    const maj = () =>
      reclamationService
        .compter()
        .then(({ non_resolues }) => setPastilles((p) => ({ ...p, reclamations: non_resolues })))
        .catch(() => {})
    maj()
    window.addEventListener('reclamations-maj', maj)
    return () => window.removeEventListener('reclamations-maj', maj)
  }, [location.pathname])

  const handleLogout = () => {
    authService.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/logo-jirama-embleme.png" alt="Logo JIRAMA" />
          Gestion Clientèle
        </div>
        <nav>
          {links.map(({ to, label, end, Icon, pastille }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon />
              <span>{label}</span>
              {pastille && pastilles[pastille] > 0 && (
                <span className="nav-pastille" aria-label={`${pastilles[pastille]} non résolue(s)`}>
                  {pastilles[pastille]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-name">
            <IconUtilisateur size={18} />
            <span>
              {user?.nom || user?.username}
              <small className="sidebar-role">
                {user?.role === 'admin' ? 'Administrateur' : 'Agent'}
              </small>
            </span>
          </div>
          <button className="btn btn-secondary btn-sm sidebar-logout" onClick={handleLogout}>
            <IconDeconnexion size={16} />
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
