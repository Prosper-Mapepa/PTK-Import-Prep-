import { searchCollegeCeeb } from '../../src/lib/ceebReferenceServer'

export default async (request: Request) => {
  const url = new URL(request.url)
  const college = url.searchParams.get('college')?.trim()

  if (!college) {
    return Response.json({ error: 'Missing college parameter.' }, { status: 400 })
  }

  try {
    const result = await searchCollegeCeeb(college)
    return Response.json({ college, code: result.code, source: result.source })
  } catch {
    return Response.json({ error: 'Online CEEB search failed.' }, { status: 500 })
  }
}
