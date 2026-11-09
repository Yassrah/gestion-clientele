import { Navigate, useLocation } from 'react-router-dom'
import { authService } from '../services/auth.service'

// Redirige vers /login si aucun utilisateur n'est connecté
export default function RequireAuth({ children }) {
  const location = useLocation()

  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
