import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Abonnes from './pages/Abonnes'
import Contrats from './pages/Contrats'
import Compteurs from './pages/Compteurs'
import Releves from './pages/Releves'
import Tarifs from './pages/Tarifs'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="abonnes" element={<Abonnes />} />
        <Route path="contrats" element={<Contrats />} />
        <Route path="compteurs" element={<Compteurs />} />
        <Route path="releves" element={<Releves />} />
        <Route path="tarifs" element={<Tarifs />} />
      </Route>
    </Routes>
  )
}
