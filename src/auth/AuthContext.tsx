import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loginWithUsernamePassword, logoutSession, type AuthUser } from '../lib/authClient'

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  configured: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)

  async function refresh() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' })
      if (response.status === 503) {
        setConfigured(false)
        setUser(null)
        return
      }
      setConfigured(true)
      if (!response.ok) {
        setUser(null)
        return
      }
      const data = (await response.json()) as { user?: AuthUser }
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    void (async () => {
      setLoading(true)
      await refresh()
      setLoading(false)
    })()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured,
      refresh,
      async login(username: string, password: string) {
        const next = await loginWithUsernamePassword(username, password)
        setConfigured(true)
        setUser(next)
      },
      async logout() {
        await logoutSession()
        setUser(null)
      },
    }),
    [user, loading, configured],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }
  return context
}
