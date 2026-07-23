import { Navigate, useLocation } from 'react-router-dom'
import { Loader } from '../components/Loader'
import { AccountBar } from './AccountBar'
import { useAuth } from './AuthContext'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="auth-loading">
        <Loader message="Checking sign-in…" variant="banner" />
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="landing-brand">CMU · Slate Import</p>
          <h1>Setup required</h1>
          <p className="auth-lead">
            Authentication is not configured yet. Add <code>AUTH_SECRET</code> and{' '}
            <code>AUTH_USERS</code> to your environment, then restart the app.
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <>
      <AccountBar />
      {children}
    </>
  )
}
