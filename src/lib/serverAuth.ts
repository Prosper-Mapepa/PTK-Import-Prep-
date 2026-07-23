import { createHmac, timingSafeEqual } from 'node:crypto'

export type AuthUser = {
  username: string
  name: string
}

export type AuthUserRecord = {
  username: string
  password: string
  name?: string
}

export const SESSION_COOKIE = 'slate_prep_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

function base64UrlEncode(value: string | Buffer): string {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value
  return buffer.toString('base64url')
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function parseAuthUsers(raw: string | undefined): AuthUserRecord[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    const users: AuthUserRecord[] = []
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue
      const record = entry as Record<string, unknown>
      const username = String(record.username ?? record.email ?? '')
        .trim()
        .toLowerCase()
      const password = String(record.password ?? '')
      const name = String(record.name ?? '').trim()
      if (!username || !password) continue
      users.push({ username, password, name: name || username })
    }
    return users
  } catch {
    return []
  }
}

export function findAuthUser(
  users: AuthUserRecord[],
  username: string,
  password: string,
): AuthUser | null {
  const normalized = username.trim().toLowerCase()
  const match = users.find((user) => safeEqual(user.username, normalized))
  if (!match) return null
  if (!safeEqual(match.password, password)) return null
  return { username: match.username, name: match.name || match.username }
}

export function createSessionToken(user: AuthUser, secret: string, now = Date.now()): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64UrlEncode(
    JSON.stringify({
      username: user.username,
      name: user.name,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS,
    }),
  )
  const data = `${header}.${payload}`
  const signature = createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${signature}`
}

export function verifySessionToken(token: string, secret: string, now = Date.now()): AuthUser | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, payload, signature] = parts
  const data = `${header}.${payload}`
  const expected = createHmac('sha256', secret).update(data).digest('base64url')
  if (!safeEqual(signature, expected)) return null

  try {
    const body = JSON.parse(base64UrlDecode(payload).toString('utf8')) as {
      username?: string
      email?: string
      name?: string
      exp?: number
    }
    const username = body.username ?? body.email
    if (!username || !body.exp) return null
    if (body.exp * 1000 < now) return null
    return {
      username: String(username).toLowerCase(),
      name: String(body.name ?? username),
    }
  } catch {
    return null
  }
}

export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (rawKey === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function buildSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function getAuthConfig(env: Record<string, string | undefined>) {
  const secret = (env.AUTH_SECRET ?? '').trim()
  const users = parseAuthUsers(env.AUTH_USERS)
  return { secret, users, configured: Boolean(secret && users.length > 0) }
}
