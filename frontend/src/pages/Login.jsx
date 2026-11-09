import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import { authService } from '../services/auth.service'
import {
  IconCadenas,
  IconConnexion,
  IconOeil,
  IconOeilBarre,
  IconUtilisateur,
} from '../components/Icons'

// Page de connexion « JIRAMA Toliara » :
//   à gauche, le visuel de la maquette (public/login-visuel-toliara.png : logo, carte, chantier) ;
//   à droite, la carte de connexion.
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [seSouvenir, setSeSouvenir] = useState(true)
  const [voirMotDePasse, setVoirMotDePasse] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Page demandée avant la redirection vers /login
  const from = location.state?.from?.pathname || '/'

  if (authService.isAuthenticated()) return <Navigate to={from} replace />

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      await authService.login(form.username.trim(), form.password, seSouvenir)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Pas d'envoi d'e-mail : les comptes sont gérés par l'administrateur (scripts/create-user.js)
  const handleOubli = () => {
    setError('')
    setInfo(
      'Contactez l\'administrateur de l\'application : il peut définir un nouveau mot de passe pour votre compte.'
    )
  }

  return (
    <div className="login-page">
      <div className="login-visuel" role="img" aria-label="JIRAMA Toliara — Ensemble pour un meilleur service à nos clients" />

      <div className="login-zone">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-icone">
            <IconCadenas size={34} />
          </div>
          <h1 className="login-titre">Connexion</h1>
          <p className="login-subtitle">Accédez à votre espace de gestion clientèle</p>

          <Alert message={error} onClose={() => setError('')} />
          <Alert type="success" message={info} onClose={() => setInfo('')} />

          <label className="login-champ">
            <span className="login-champ-icone">
              <IconUtilisateur size={20} />
            </span>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Nom d'utilisateur"
              aria-label="Nom d'utilisateur"
              autoComplete="username"
              autoFocus
              required
            />
          </label>

          <label className="login-champ">
            <span className="login-champ-icone">
              <IconCadenas size={20} />
            </span>
            <input
              name="password"
              type={voirMotDePasse ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange}
              placeholder="Mot de passe"
              aria-label="Mot de passe"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-oeil"
              onClick={() => setVoirMotDePasse(!voirMotDePasse)}
              aria-label={voirMotDePasse ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              title={voirMotDePasse ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {voirMotDePasse ? <IconOeil size={20} /> : <IconOeilBarre size={20} />}
            </button>
          </label>

          <div className="login-options">
            <label className="login-souvenir">
              <input
                type="checkbox"
                checked={seSouvenir}
                onChange={(e) => setSeSouvenir(e.target.checked)}
              />
              Se souvenir de moi
            </label>
            <button type="button" className="login-oubli" onClick={handleOubli}>
              Mot de passe oublié ?
            </button>
          </div>

          <button type="submit" className="login-submit" disabled={submitting}>
            <IconConnexion size={22} />
            {submitting ? 'Connexion...' : 'Se connecter'}
          </button>

          <div className="login-pied">
            <span>JIRAMA Toliara</span>
          </div>
        </form>
      </div>
    </div>
  )
}
