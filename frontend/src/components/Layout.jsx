import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Tableau de bord', end: true },
  { to: '/abonnes', label: 'Abonnés' },
  { to: '/contrats', label: 'Contrats' },
  { to: '/compteurs', label: 'Compteurs' },
  { to: '/releves', label: 'Relevés' },
  { to: '/tarifs', label: 'Tarifs' },
]

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">⚡ Gestion Clientèle</div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
