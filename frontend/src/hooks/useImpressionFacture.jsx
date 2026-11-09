import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import FactureDocument, { EMBLEME } from '../components/FactureDocument'
import { releveService } from '../services/releve.service'
import { factureService } from '../services/facture.service'

// Impression directe d'une facture mensuelle, sans quitter la page :
// la facture est chargée, rendue hors écran dans <body>, puis window.print() est appelé.
// Pendant l'impression, la classe body.impression-facture masque l'application (voir index.css).
//   imprimer(releveId)        : facture du mois qui contient ce relevé (page Relevés)
//   imprimerFacture(factureId): facture donnée (page Factures)
export function useImpressionFacture() {
  const [facture, setFacture] = useState(null)
  const [chargement, setChargement] = useState(null) // clé « releve-12 » / « facture-3 » en cours
  const [erreur, setErreur] = useState('')

  const charger = async (cle, requete) => {
    setErreur('')
    setChargement(cle)
    try {
      setFacture(await requete())
    } catch (err) {
      setErreur(err.message)
    } finally {
      setChargement(null)
    }
  }

  const imprimer = (releveId) =>
    charger(`releve-${releveId}`, () => releveService.getFacture(releveId))
  const imprimerFacture = (factureId) =>
    charger(`facture-${factureId}`, () => factureService.getImpression(factureId))
  const enCours = (type, id) => chargement === `${type}-${id}`

  useEffect(() => {
    if (!facture) return undefined

    const titre = document.title
    // Le titre sert de nom de fichier par défaut en « Enregistrer au format PDF »
    document.title = facture.numero_facture
    document.body.classList.add('impression-facture')

    const terminer = () => {
      document.body.classList.remove('impression-facture')
      document.title = titre
      setFacture(null)
    }
    window.addEventListener('afterprint', terminer, { once: true })

    // On attend que l'emblème soit chargé pour qu'il apparaisse sur la facture
    let annule = false
    const img = new Image()
    img.src = EMBLEME
    img.decode()
      .catch(() => {})
      .finally(() => {
        if (!annule) window.print()
      })

    return () => {
      annule = true
      window.removeEventListener('afterprint', terminer)
      document.body.classList.remove('impression-facture')
      document.title = titre
    }
  }, [facture])

  const zoneImpression = facture
    ? createPortal(
        <div className="print-zone">
          <FactureDocument facture={facture} />
        </div>,
        document.body
      )
    : null

  return { imprimer, imprimerFacture, enCours, erreur, setErreur, zoneImpression }
}
