import { normalizeZipCode } from '../../src/lib/addressClean'
import { validateWithSmarty } from '../../src/lib/smartyServer'

export default async (request: Request) => {
  const url = new URL(request.url)
  const street = url.searchParams.get('street')?.trim() ?? ''
  const city = url.searchParams.get('city')?.trim() ?? ''
  const state = url.searchParams.get('state')?.trim() ?? ''
  const zip = normalizeZipCode(url.searchParams.get('zip')?.trim() ?? '')
  const authId = process.env.SMARTY_AUTH_ID ?? ''
  const authToken = process.env.SMARTY_AUTH_TOKEN ?? ''

  if (!authId || !authToken) {
    return Response.json(
      {
        error: 'Smarty credentials missing. Add SMARTY_AUTH_ID and SMARTY_AUTH_TOKEN in Netlify.',
        configured: false,
      },
      { status: 503 },
    )
  }

  if (!street) {
    return Response.json({ error: 'Missing street parameter.' }, { status: 400 })
  }

  try {
    const result = await validateWithSmarty({ street, city, state, zip }, authId, authToken)
    return Response.json({ configured: true, ...result })
  } catch {
    return Response.json({ error: 'Address validation failed.', configured: true }, { status: 500 })
  }
}
