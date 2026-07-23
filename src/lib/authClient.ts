import type { AuthUser } from '../lib/serverAuth'

export type { AuthUser }

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me', {
    credentials: 'include',
  })
  if (response.status === 401) return null
  if (!response.ok) {
    throw new Error('Could not verify your session.')
  }
  const data = (await response.json()) as { user?: AuthUser }
  return data.user ?? null
}

export async function loginWithUsernamePassword(
  username: string,
  password: string,
): Promise<AuthUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  const data = (await response.json().catch(() => ({}))) as {
    user?: AuthUser
    error?: string
  }

  if (!response.ok || !data.user) {
    throw new Error(data.error || 'Invalid username or password.')
  }

  return data.user
}

export async function logoutSession(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
}
