import { loadEnv, type Connect, type Plugin } from 'vite'
import { searchCollegeCeeb } from './src/lib/ceebReferenceServer'

function normalizeZipCode(zip: string): string {
  const trimmed = zip.trim()
  if (!trimmed) return ''

  const match = trimmed.match(/^(\d{1,5})(-\d{4})?$/)
  if (!match) return trimmed

  const base = match[1].padStart(5, '0')
  return match[2] ? `${base}${match[2]}` : base
}

type SmartyCandidate = {
  delivery_line_1?: string
  delivery_line_2?: string
  components?: {
    primary_number?: string
    city_name?: string
    state_abbreviation?: string
    zipcode?: string
    plus4_code?: string
  }
  analysis?: {
    dpv_match_code?: string
  }
}

async function validateWithSmarty(
  params: {
    street: string
    city: string
    state: string
    zip: string
  },
  authId: string,
  authToken: string,
): Promise<{
  valid: boolean
  standardized?: {
    address1: string
    address2: string
    city: string
    state: string
    zip: string
  }
  dpvMatchCode?: string
  message: string
}> {
  const query = new URLSearchParams({
    'auth-id': authId,
    'auth-token': authToken,
    street: params.street,
    city: params.city,
    state: params.state,
    zipcode: params.zip,
    candidates: '1',
    match: 'enhanced',
  })

  const response = await fetch(
    `https://us-street.api.smarty.com/street-address?${query.toString()}`,
  )

  if (!response.ok) {
    if (response.status === 401 || response.status === 402) {
      return { valid: false, message: 'Smarty credentials rejected. Check auth ID and token.' }
    }
    return { valid: false, message: `Smarty request failed (${response.status}).` }
  }

  const results = (await response.json()) as SmartyCandidate[]
  if (!results.length) {
    return { valid: false, message: 'Address not found in USPS data.' }
  }

  const match = results[0]
  const dpv = match.analysis?.dpv_match_code ?? ''
  const hasCandidate = Boolean(
    match.delivery_line_1?.trim() && match.components?.zipcode && match.components?.primary_number,
  )
  const dpvConfirmed = ['Y', 'S', 'D'].includes(dpv)
  const valid = dpvConfirmed || hasCandidate
  const zip = match.components?.zipcode ?? params.zip
  const plus4 = match.components?.plus4_code
  const zipFormatted = plus4 ? `${zip}-${plus4}` : zip

  return {
    valid,
    dpvMatchCode: dpv,
    standardized: valid
      ? {
          address1: match.delivery_line_1 ?? params.street,
          address2: match.delivery_line_2 ?? '',
          city: match.components?.city_name ?? params.city,
          state: match.components?.state_abbreviation ?? params.state,
          zip: zipFormatted,
        }
      : undefined,
    message: valid
      ? dpvConfirmed
        ? 'Verified by Smarty (USPS).'
        : 'Standardized by Smarty.'
      : 'Address not found in USPS data.',
  }
}

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
