import { loadEnv, type Connect, type Plugin } from 'vite'
import { normalizeZipCode } from './src/lib/addressClean'
import { searchCollegeCeeb } from './src/lib/ceebReferenceServer'
import { validateWithSmarty } from './src/lib/smartyServer'

function createApiMiddleware(env: Record<string, string>): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/')) {
      next()
      return
    }

    const url = new URL(req.url, 'http://localhost')

    if (url.pathname === '/api/ceeb/search') {
      const college = url.searchParams.get('college')?.trim()
      res.setHeader('Content-Type', 'application/json')

      if (!college) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing college parameter.' }))
        return
      }

      try {
        const result = await searchCollegeCeeb(college)
        res.statusCode = 200
        res.end(JSON.stringify({ college, code: result.code, source: result.source }))
      } catch {
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Online CEEB search failed.' }))
      }
      return
    }

    if (url.pathname === '/api/address/validate') {
      const street = url.searchParams.get('street')?.trim() ?? ''
      const city = url.searchParams.get('city')?.trim() ?? ''
      const state = url.searchParams.get('state')?.trim() ?? ''
      const zip = normalizeZipCode(url.searchParams.get('zip')?.trim() ?? '')
      const authId = env.SMARTY_AUTH_ID ?? ''
      const authToken = env.SMARTY_AUTH_TOKEN ?? ''

      res.setHeader('Content-Type', 'application/json')

      if (!authId || !authToken) {
        res.statusCode = 503
        res.end(
          JSON.stringify({
            error: 'Smarty credentials missing. Add SMARTY_AUTH_ID and SMARTY_AUTH_TOKEN to .env',
            configured: false,
          }),
        )
        return
      }

      if (!street) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing street parameter.' }))
        return
      }

      try {
        const result = await validateWithSmarty({ street, city, state, zip }, authId, authToken)
        res.statusCode = 200
        res.end(JSON.stringify({ configured: true, ...result }))
      } catch {
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Address validation failed.', configured: true }))
      }
      return
    }

    next()
  }
}

export function apiPlugin(): Plugin {
  let env: Record<string, string> = {}

  return {
    name: 'ptk-api',
    config(_, { mode }) {
      env = loadEnv(mode, process.cwd(), '')
    },
    configureServer(server) {
      server.middlewares.use(createApiMiddleware(env))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createApiMiddleware(env))
    },
  }
}
