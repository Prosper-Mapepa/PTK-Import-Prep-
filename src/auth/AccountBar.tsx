import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function AccountBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="account-bar">
      <span className="account-bar-user" title={user.username}>
        {user.name}
      </span>
      <button type="button" className="btn btn-ghost account-bar-logout" onClick={() => void handleLogout()}>
        Sign out
      </button>
    </div>
  )
}
