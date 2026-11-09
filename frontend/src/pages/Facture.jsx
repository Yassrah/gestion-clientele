import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { releveService } from '../services/releve.service'
import Alert from '../components/Alert'
import FactureDocument from '../components/FactureDocument'

export default function Facture() {
  const { id } = useParams()
  const [facture, setFacture] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await releveService.getFacture(id)
        if (mounted) setFacture(data)
      } catch (err) {
        if (mounted) setError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) {
    return <div className="loading">Chargement de la facture...</div>
  }

  if (error) {
    return (
      <div>
        <Alert type="error" message={error} />
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link className="btn btn-secondary" to="/releves">
            ← Retour aux relevés
          </Link>
          {/* Cas le plus courant : le compteur n'a pas de tarif */}
          {error.includes('tarif') && (
            <Link className="btn" to="/compteurs">
              Associer un tarif au compteur
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!facture) return null

  return (
    <div className="fac-page">
      <div className="fac-toolbar no-print">
        <Link className="btn btn-secondary" to="/releves">
          ← Retour aux relevés
        </Link>
        <button className="btn" onClick={() => window.print()}>
          Imprimer
        </button>
      </div>
      <FactureDocument facture={facture} />
    </div>
  )
}
