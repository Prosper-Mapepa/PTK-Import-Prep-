import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Loader } from '../components/Loader'

export default function LoginPage() {
  const { user, loading, login, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="auth-loading">
        <Loader message="Checking sign-in…" variant="banner" />
      </div>
    )
  }

  if (user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="landing-brand">CMU · Slate Import</p>
        <h1>Sign in</h1>
        <p className="auth-lead">Use your username and password to open File Prep.</p>

        {!configured && (
          <p className="alert alert-error">
            Auth is not configured. Set <code>AUTH_SECRET</code> and <code>AUTH_USERS</code> in
            `.env`.
          </p>
        )}

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="auth-field">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              disabled={submitting || !configured}
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={submitting || !configured}
            />
          </label>

          {error && <p className="alert alert-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={submitting || !configured}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
