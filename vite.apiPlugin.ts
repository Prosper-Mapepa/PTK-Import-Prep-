import { loadEnv, type Connect, type Plugin } from 'vite'

function collegeToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function slugVariants(name: string): string[] {
  const base = collegeToSlug(name)
  const variants = new Set<string>()
  if (base) variants.add(base)

  const simplified = collegeToSlug(
    name
      .replace(/\bat\b/gi, '')
      .replace(/\bthe\b/gi, '')
      .replace(/\bof\b/gi, ''),
  )
  if (simplified) variants.add(simplified)

  return [...variants]
}

async function fetchCollegeBoardCode(college: string): Promise<string | null> {
  const slugs = slugVariants(college)

  for (const slug of slugs) {
    const response = await fetch(`https://bigfuture.collegeboard.org/colleges/${slug}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PTK-Slate-Prep/1.0)',
        Accept: 'text/html',
      },
    })

    if (!response.ok) continue

    const html = await response.text()
    const codeMatch = html.match(/"diCode":"(\d{4})"/)
    if (!codeMatch) continue

    const nameMatch = html.match(/"name":"([^"]+)"/)
    if (nameMatch) {
      const foundName = nameMatch[1].toLowerCase()
      const queryTokens = college
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2)
      const matchedTokens = queryTokens.filter((token) => foundName.includes(token))
      if (queryTokens.length > 0 && matchedTokens.length < Math.min(2, queryTokens.length)) {
        continue
      }
    }

    return codeMatch[1]
  }

  return null
}

type SmartyCandidate = {
  delivery_line_1?: string
  delivery_line_2?: string
  components?: {
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
    match: 'invalid',
  })

  const response = await fetch(
    `https://us-street.api.smarty.com/street-address?${query.toString()}`,
  )

  if (!response.ok) {
    return { valid: false, message: 'Smarty request failed.' }
  }

  const results = (await response.json()) as SmartyCandidate[]
  if (!results.length) {
    return { valid: false, message: 'Address not found in USPS data.' }
  }

  const match = results[0]
  const dpv = match.analysis?.dpv_match_code ?? ''
  const valid = ['Y', 'S', 'D'].includes(dpv)
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
    message: valid ? 'Verified by Smarty (USPS).' : 'Could not verify with Smarty.',
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
        const code = await fetchCollegeBoardCode(college)
        res.statusCode = 200
        res.end(JSON.stringify({ college, code, source: 'college-board' }))
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
      const zip = url.searchParams.get('zip')?.trim() ?? ''
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
