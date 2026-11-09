import { readSheet } from 'read-excel-file/browser'
import writeExcelFile from 'write-excel-file/browser'

// ---------- Import / modèle Excel des sites ----------
// Colonnes reconnues (1re ligne du fichier, majuscules et accents ignorés) :
//   code     : « Réf. site », « Référence », « Code », « Site »
//   quartier : « Quartier »
//   ville    : « Ville », « Commune »
const ALIAS = {
  code: ['ref site', 'ref. site', 'reference site', 'reference', 'ref', 'code site', 'code', 'site', 'numero site'],
  quartier: ['quartier', 'fokontany'],
  ville: ['ville', 'commune', 'localite'],
}

const normaliser = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const ENTETES_MODELE = ['Réf. site', 'Quartier', 'Ville']

// Lit le 1er onglet d'un fichier .xlsx et renvoie { lignes, erreur }.
// Chaque ligne : { ligne (n° dans Excel), code, quartier, ville, erreur? }
export async function lireSitesExcel(fichier) {
  if (!/\.xlsx$/i.test(fichier.name)) {
    return { erreur: 'Format non pris en charge : enregistrez le fichier au format Excel .xlsx' }
  }

  let rows
  try {
    rows = await readSheet(fichier)
  } catch {
    return { erreur: 'Fichier illisible : vérifiez qu\'il s\'agit bien d\'un classeur Excel (.xlsx)' }
  }
  if (!rows || rows.length < 2) {
    return { erreur: 'Le fichier est vide : il faut une ligne d\'en-tête puis au moins un site' }
  }

  // Repère les colonnes d'après la ligne d'en-tête
  const entetes = rows[0].map(normaliser)
  const colonnes = {}
  for (const [champ, alias] of Object.entries(ALIAS)) {
    const index = entetes.findIndex((e) => alias.includes(e))
    if (index === -1) {
      return {
        erreur: `Colonne « ${champ === 'code' ? 'Réf. site' : champ[0].toUpperCase() + champ.slice(1)} » introuvable en 1re ligne. ` +
          `En-têtes attendus : ${ENTETES_MODELE.join(', ')} (téléchargez le modèle)`,
      }
    }
    colonnes[champ] = index
  }

  const lignes = []
  rows.slice(1).forEach((row, i) => {
    const cellule = (champ) => {
      const v = row[colonnes[champ]]
      // Un code saisi comme nombre (611) est lu 611 : on le garde en texte, sans décimales
      return typeof v === 'number' ? String(Math.trunc(v)) : String(v ?? '').trim()
    }
    const l = { ligne: i + 2, code: cellule('code'), quartier: cellule('quartier'), ville: cellule('ville') }
    if (!l.code && !l.quartier && !l.ville) return // ligne vide ignorée

    // Mêmes règles que le serveur (site.controller.js)
    if (!l.code) l.erreur = 'Réf. site manquante'
    else if (!/^\d{1,10}$/.test(l.code)) l.erreur = 'Réf. site : chiffres uniquement (10 maximum)'
    else if (!l.quartier) l.erreur = 'Quartier manquant'
    else if (!l.ville) l.erreur = 'Ville manquante'
    lignes.push(l)
  })

  // Codes en double dans le fichier
  const premiers = new Map()
  for (const l of lignes) {
    if (l.erreur) continue
    if (premiers.has(l.code)) l.erreur = `Code en double (déjà ligne ${premiers.get(l.code)})`
    else premiers.set(l.code, l.ligne)
  }

  if (lignes.length === 0) {
    return { erreur: 'Aucun site trouvé sous la ligne d\'en-tête' }
  }
  return { lignes }
}

// Télécharge un modèle Excel prêt à remplir (en-têtes + exemples)
export async function telechargerModeleSites() {
  const gras = (value) => ({ value, fontWeight: 'bold' })
  const data = [
    ENTETES_MODELE.map(gras),
    [{ value: '611', type: String }, { value: 'Besakoa' }, { value: 'Toliara' }],
    [{ value: '621', type: String }, { value: 'Nosy Kely' }, { value: 'Morondava' }],
  ]
  await writeExcelFile(data, { columns: [{ width: 12 }, { width: 28 }, { width: 22 }] }).toFile('modele-import-sites.xlsx')
}
