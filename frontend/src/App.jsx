import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Abonnes from './pages/Abonnes'
import Contrats from './pages/Contrats'
import Compteurs from './pages/Compteurs'
import Releves from './pages/Releves'
import Tarifs from './pages/Tarifs'
import Facture from './pages/Facture'
import Factures from './pages/Factures'
import Sites from './pages/Sites'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="sites" element={<Sites />} />
        <Route path="abonnes" element={<Abonnes />} />
        <Route path="contrats" element={<Contrats />} />
        <Route path="compteurs" element={<Compteurs />} />
        <Route path="releves" element={<Releves />} />
        <Route path="tarifs" element={<Tarifs />} />
        <Route path="factures" element={<Factures />} />
      </Route>
      {/* Facture imprimable : page pleine largeur, hors du layout */}
      <Route
        path="/releves/:id/facture"
        element={
          <RequireAuth>
            <Facture />
          </RequireAuth>
        }
      />
    </Routes>
  )
}
