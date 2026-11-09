import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import { authService } from '../services/auth.service'
import { IconAbonnes, IconCompteurs, IconEclair, IconFactures } from '../components/Icons'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
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
    setSubmitting(true)
    try {
      await authService.login(form.username.trim(), form.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      {/* Décor : halos lumineux et vagues bleu / orange */}
      <div className="login-glow login-glow-1" aria-hidden="true" />
      <div className="login-glow login-glow-2" aria-hidden="true" />
      <svg className="login-waves" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true">
        <path className="wave-orange" d="M0,224 C240,170 480,300 760,250 C1040,200 1240,120 1440,160 L1440,320 L0,320 Z" />
        <path className="wave-blue" d="M0,270 C300,220 560,320 860,285 C1120,255 1300,210 1440,230 L1440,320 L0,320 Z" />
      </svg>

      <section className="login-hero">
        <div className="login-hero-brand">
          <div className="login-logo-tile">
            <img src="/logo-jirama.png" alt="Logo JIRAMA" />
          </div>
          <div>
            <div className="login-hero-name">JIRAMA</div>
            <div className="login-hero-tagline">Jiro sy Rano Malagasy</div>
          </div>
        </div>

        <h2 className="login-hero-title">
          Suivez et gérez votre clientèle <span>en toute simplicité</span>
        </h2>
        <div className="login-hero-bar" />

        <ul className="login-features">
          <li>
            <span className="login-feature-icon">
              <IconAbonnes size={26} />
            </span>
            Abonnés et contrats en un clic
          </li>
          <li>
            <span className="login-feature-icon">
              <IconCompteurs size={26} />
            </span>
            Suivi des relevés et consommations
          </li>
          <li>
            <span className="login-feature-icon">
              <IconFactures size={26} />
            </span>
            Facturation automatique
          </li>
        </ul>
      </section>

      <p className="login-slogan" aria-hidden="true">
        L'eau et l'électricité,
        <br />
        notre engagement
      </p>

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card-head">
          <div className="login-logo-tile small">
            <img src="/logo-jirama.png" alt="" />
          </div>
          <div>
            <div className="login-card-name">
              <span className="brand-mark">
                <IconEclair size={14} />
              </span>
              JIRAMA
            </div>
            <p className="login-subtitle">Gestion clientèle — connexion</p>
          </div>
        </div>

        <Alert message={error} onClose={() => setError('')} />

        <div className="form-group">
          <label htmlFor="username">Identifiant</label>
          <input
            id="username"
            name="username"
            value={form.username}
            onChange={handleChange}
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" className="btn login-submit" disabled={submitting}>
          {submitting ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
