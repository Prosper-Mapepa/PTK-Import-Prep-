import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionToken,
  findAuthUser,
  getAuthConfig,
  readCookie,
  SESSION_COOKIE,
  verifySessionToken,
  type AuthUser,
} from './serverAuth'

function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url)
  return url.protocol === 'https:'
}

function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, init)
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function getUserFromRequest(request: Request, secret: string): AuthUser | null {
  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE)
  if (!token || !secret) return null
  return verifySessionToken(token, secret)
}

export async function handleAuthRequest(
  request: Request,
  env: Record<string, string | undefined>,
): Promise<Response> {
  const url = new URL(request.url)
  const { secret, users, configured } = getAuthConfig(env)
  const secure = isSecureRequest(request)

  if (url.pathname === '/api/auth/me' && request.method === 'GET') {
    if (!configured) {
      return json({ error: 'Authentication is not configured.', configured: false }, { status: 503 })
    }
    const user = getUserFromRequest(request, secret)
    if (!user) return json({ error: 'Not authenticated.' }, { status: 401 })
    return json({ user, configured: true })
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    if (!configured) {
      return json(
        {
          error:
            'Authentication is not configured. Set AUTH_SECRET and AUTH_USERS in the environment.',
          configured: false,
        },
        { status: 503 },
      )
    }

    const body = await readJsonBody(request)
    const username = String(body.username ?? body.email ?? '')
    const password = String(body.password ?? '')
    const user = findAuthUser(users, username, password)
    if (!user) {
      return json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    const token = createSessionToken(user, secret)
    return json(
      { user },
      {
        status: 200,
        headers: {
          'Set-Cookie': buildSessionCookie(token, secure),
        },
      },
    )
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    return json(
      { ok: true },
      {
        status: 200,
        headers: {
          'Set-Cookie': clearSessionCookie(secure),
        },
      },
    )
  }

  return json({ error: 'Not found.' }, { status: 404 })
}
