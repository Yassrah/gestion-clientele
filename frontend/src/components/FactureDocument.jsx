import { formatDate, formatMoney, montantEnLettres } from '../utils/format'

// ===== Informations de la société imprimées sur la facture (modifiables) =====
export const SOCIETE = {
  nom: 'JIRAMA',
  adresse: '149, RUE RAINANDRIAMAMPANDRY ANTANANARIVO',
  bp: 'BP : 200',
  nif: 'NIF 1 000 000 704',
  statistique: 'STATISTIQUE N° 36003 11 1957 0 10005',
  rcs: 'RCS 2004 B 00 553',
  telephone: '3547',
  email: 'service-client@jirama.mg',
}

export const EMBLEME = '/logo-jirama-embleme.png'

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

const nombre = (v) =>
  v === null || v === undefined || v === ''
    ? ''
    : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 2 })

// « … ARIARY ET CINQUANTE CENTIMES » (et non « … ET CINQUANTE CENTIMES ARIARY »)
const sommeEnLettres = (total) => {
  const entier = Math.floor(total)
  const centimes = Math.round((total - entier) * 100)
  let texte = `${montantEnLettres(entier)} ariary`
  if (centimes > 0) texte += ` et ${montantEnLettres(centimes)} centimes`
  return texte.toUpperCase()
}

// Agence : la ville, dernier élément de l'adresse de l'abonné
const agence = (adresse) => {
  const parties = String(adresse || '').split(',')
  return parties[parties.length - 1].trim() || SOCIETE.nom
}

const somme = (lignes, cle) => lignes.reduce((s, l) => s + Number(l[cle] || 0), 0)

// Valeurs d'un côté du tableau (électricité ou eau) à partir des lignes de ce type ;
// sans ligne, le côté reste vide. Plusieurs relevés du même compteur dans le mois :
// ancien index du premier, nouvel index du dernier, quantités et montants additionnés.
function cote(lignes) {
  if (lignes.length === 0) return {}
  const premier = lignes[0]
  const dernier = lignes[lignes.length - 1]
  const compteurs = [...new Set(lignes.map((l) => l.numero_compteur))]
  const unSeulCompteur = compteurs.length === 1
  const prix = [...new Set(lignes.map((l) => Number(l.prix_unitaire)))]
  return {
    compteur: compteurs.join(', '),
    tarif: dernier.type_tarif,
    dateNouvel: unSeulCompteur ? formatDate(dernier.date_releve) : '',
    nouvel: unSeulCompteur ? nombre(dernier.nouvel_index) : '',
    dateAncien: unSeulCompteur && premier.date_precedente ? formatDate(premier.date_precedente) : '',
    ancien: unSeulCompteur ? nombre(premier.ancien_index) : '',
    conso: nombre(somme(lignes, 'consommation')),
    jours: somme(lignes, 'nombre_jours'),
    coef: 1,
    quantite: nombre(somme(lignes, 'consommation')),
    prix: prix.length === 1 ? formatMoney(prix[0]) : '',
    montant: formatMoney(somme(lignes, 'montant_ht')),
    taxeCommunale: formatMoney(somme(lignes, 'taxe_communale')),
    tva: formatMoney(somme(lignes, 'tva')),
    sousTotalEtat: formatMoney(somme(lignes, 'taxe_communale') + somme(lignes, 'tva')),
    total: formatMoney(somme(lignes, 'total')),
  }
}

// Facture mensuelle au format officiel JIRAMA (en-tête, tableau Électricité / Eau, talon).
// Elle regroupe les relevés d'un contrat pour un mois : chaque colonne est remplie par ses lignes.
export default function FactureDocument({ facture: f }) {
  const lignes = f.lignes || []
  const elec = cote(lignes.filter((l) => l.type === 'electricite'))
  const eau = cote(lignes.filter((l) => l.type === 'eau'))
  const total = Number(f.total || 0)

  // Période AAAA-MM → « Octobre 2026 »
  const [annee, numMois] = String(f.periode || '').split('-')
  const mois = numMois ? `${MOIS_FR[Number(numMois) - 1]} ${annee}` : ''

  // Ligne "valeur seule" : la valeur est dans la colonne Montant du côté concerné
  const ligneValeur = (libelle, cle, className = '') => (
    <tr className={className}>
      <td className="fj-libelle">{libelle}</td>
      <td colSpan="2" />
      <td className="fj-num">{elec[cle]}</td>
      <td colSpan="2" />
      <td className="fj-num">{eau[cle]}</td>
    </tr>
  )

  // Lignes de détail empilées (tranches, taxes) : une ligne par libellé
  const lignesDetail = (lignes) =>
    lignes.map(([libelle, cleQte, clePrix, cleMontant], i) => (
      <tr key={libelle} className={`fj-detail ${i === 0 ? 'fj-detail-first' : ''}`}>
        <td className="fj-libelle">{libelle}</td>
        <td className="fj-num">{elec[cleQte]}</td>
        <td className="fj-num">{elec[clePrix]}</td>
        <td className="fj-num">{elec[cleMontant]}</td>
        <td className="fj-num">{eau[cleQte]}</td>
        <td className="fj-num">{eau[clePrix]}</td>
        <td className="fj-num">{eau[cleMontant]}</td>
      </tr>
    ))

  // Bloc index d'un côté : libellé (colonne 1), date, index
  const indexCote = (c, libelle, cleDate, cleIndex) => (
    <>
      <td className="fj-sous-libelle">{libelle}</td>
      <td className="fj-centre">{c[cleDate]}</td>
      <td className="fj-num">{c[cleIndex]}</td>
    </>
  )

  const resumeCote = (c, libelle, cle) => (
    <td colSpan="3" className="fj-resume">
      <span>{libelle}</span>
      <strong>{c[cle] ?? ''}</strong>
    </td>
  )

  return (
    <div className="fj-sheet">
      {/* ---------- En-tête : société / DOIT ---------- */}
      <div className="fj-entete">
        <div className="fj-societe">
          <img src={EMBLEME} alt="JIRAMA" className="fj-embleme" />
          <div className="fj-societe-infos">
            <div>{SOCIETE.adresse}</div>
            <div>{SOCIETE.bp}</div>
            <div>{SOCIETE.nif}</div>
            <div>{SOCIETE.statistique}</div>
            <div>{SOCIETE.rcs}</div>
          </div>
        </div>

        <div className="fj-doit">
          <div className="fj-doit-titre">
            DOIT : <strong>{f.prenom} {f.nom}</strong>
          </div>
          <div className="fj-doit-grille">
            <span>Adresse :</span>
            <strong className="fj-doit-large">{f.adresse}</strong>
            <span>Référence client :</span>
            <strong>{f.numero_abonne}</strong>
            <span>Réf. Enc :</span>
            <strong>{f.numero_contrat}</strong>
            <span>Catégorie :</span>
            <strong>{f.type_contrat}</strong>
            <span>Code TVA :</span>
            <strong>0</strong>
          </div>
        </div>
      </div>

      {/* ---------- Tableau principal ---------- */}
      <table className="fj-table">
        <colgroup>
          <col className="fj-col-libelle" />
          <col /><col /><col />
          <col /><col /><col />
        </colgroup>
        <tbody>
          <tr>
            <td rowSpan="9" className="fj-meta">
              <div className="fj-meta-facture">
                FACTURE N° <strong>{f.numero_facture}</strong>
              </div>
              <div>Mois de : <strong>{mois}</strong></div>
              <div>Date d'édition : <strong>{formatDate(f.date_emission)}</strong></div>
              <div>Date de présentation : <strong>{formatDate(f.date_emission)}</strong></div>
              <div>Date limite de paiement : <strong>{formatDate(f.date_echeance)}</strong></div>
              <div className="fj-meta-espace" />
              <div>Agence : <strong>{agence(f.adresse)}</strong></div>
              <div>Téléphone : <strong>{SOCIETE.telephone}</strong></div>
              <div>e-mail : <strong>{SOCIETE.email}</strong></div>
            </td>
            <th colSpan="3" className="fj-th-elec">ÉLECTRICITÉ</th>
            <th colSpan="3" className="fj-th-eau">EAU</th>
          </tr>
          <tr>
            <td>Compteur n° : <strong>{elec.compteur}</strong></td>
            <td>Tarif : <strong>{elec.tarif}</strong></td>
            <td>PS (kW) :</td>
            <td>Compteur n° : <strong>{eau.compteur}</strong></td>
            <td>Tarif : <strong>{eau.tarif}</strong></td>
            <td>Ø (mm) :</td>
          </tr>
          <tr className="fj-entete-colonnes">
            <td />
            <td>Date</td>
            <td>Index</td>
            <td />
            <td>Date</td>
            <td>Index</td>
          </tr>
          <tr>
            {indexCote(elec, 'Nouvel index', 'dateNouvel', 'nouvel')}
            {indexCote(eau, 'Nouvel index', 'dateNouvel', 'nouvel')}
          </tr>
          <tr>
            {indexCote(elec, 'Ancien index', 'dateAncien', 'ancien')}
            {indexCote(eau, 'Ancien index', 'dateAncien', 'ancien')}
          </tr>
          <tr className="fj-resume-premier">
            {resumeCote(elec, 'Consommation totale :', 'conso')}
            {resumeCote(eau, 'Consommation totale :', 'conso')}
          </tr>
          <tr>
            {resumeCote(elec, 'Nombre de jours de consommation :', 'jours')}
            {resumeCote(eau, 'Nombre de jours de consommation :', 'jours')}
          </tr>
          <tr>
            {resumeCote(elec, 'Coefficient de tranche :', 'coef')}
            {resumeCote(eau, 'Coefficient de tranche :', 'coef')}
          </tr>
          <tr className="fj-bande">
            <td colSpan="3" className="fj-bande-elec" />
            <td colSpan="3" className="fj-bande-eau" />
          </tr>

          <tr className="fj-entete-colonnes">
            <td />
            <td>Quantité (kWh)</td>
            <td>Prix unitaire (Ar)</td>
            <td>Montant (Ar)</td>
            <td>Quantité (m³)</td>
            <td>Prix unitaire (Ar)</td>
            <td>Montant (Ar)</td>
          </tr>
          {lignesDetail([
            ['1ère tranche de consommation', 'quantite', 'prix', 'montant'],
            ['2ème tranche de consommation'],
            ['Redevance'],
            ['Prime fixe'],
            ['Autres frais'],
          ])}
          {ligneValeur(`Sous total ${SOCIETE.nom}`, 'montant', 'fj-sous-total')}
          {lignesDetail([
            ['Taxe communale', null, null, 'taxeCommunale'],
            ['Surtaxe communale'],
            ['Redevance Fonds National d\'Électricité'],
            ['Redevance Assainissement Eaux usées'],
            ['TVA', null, null, 'tva'],
          ])}
          {ligneValeur('Sous total État et Services Publics', 'sousTotalEtat', 'fj-sous-total')}
          {ligneValeur('TOTAL', 'total', 'fj-total')}
        </tbody>
      </table>

      {/* ---------- Net à payer / signature ---------- */}
      <div className="fj-pied">
        <div className="fj-pied-gauche">
          <div className="fj-net">
            NET A PAYER : <strong>{formatMoney(total)} Ariary</strong>
          </div>
          <div className="fj-arrete">
            Arrêté à la somme de : <strong>{sommeEnLettres(total)}</strong>
          </div>
          {f.statut === 'payee' && (
            <div className="fj-acquittee">ACQUITTÉE le {formatDate(f.date_paiement)}</div>
          )}
        </div>
        <div className="fj-signature">
          <span>(Signature)</span>
          <span>Directeur Commercial</span>
        </div>
      </div>

      {/* ---------- Talon détachable ---------- */}
      <div className="fj-decoupe">
        <span className="fj-ciseaux">✂</span>
      </div>

      <div className="fj-talon">
        <div className="fj-talon-logo">
          <img src={EMBLEME} alt="" className="fj-embleme" />
        </div>
        <div className="fj-talon-infos">
          <div className="fj-meta-facture">
            FACTURE N° <strong>{f.numero_facture}</strong>
          </div>
          <div>Agence : <strong>{agence(f.adresse)}</strong></div>
          <div>Référence client : <strong>{f.numero_abonne}</strong></div>
        </div>
        <div className="fj-talon-infos">
          <div>Mois de : <strong>{mois}</strong></div>
          <div>Catégorie : <strong>{f.type_contrat}</strong></div>
          <div>Réf. Enc : <strong>{f.numero_contrat}</strong></div>
        </div>
        <div className="fj-talon-total">
          <div>Total à payer Électricité : <strong>{elec.total || '—'}</strong></div>
          <div>Total à payer Eau : <strong>{eau.total || '—'}</strong></div>
          <div className="fj-talon-net">
            NET A PAYER : <strong>{formatMoney(total)} Ariary</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
