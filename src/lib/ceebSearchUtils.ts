const ABBREVIATIONS: Record<string, string> = {
  CC: 'COMMUNITY COLLEGE',
  COMM: 'COMMUNITY',
  UNIV: 'UNIVERSITY',
  COLL: 'COLLEGE',
  COL: 'COLLEGE',
  INST: 'INSTITUTE',
  ST: 'STATE',
  SR: 'SENIOR',
  JR: 'JUNIOR',
  TECH: 'TECHNICAL',
  POLY: 'POLYTECHNIC',
  GA: 'GEORGIA',
}

const STOP_WORDS = new Set(['THE', 'OF', 'AND', 'AT', 'A', 'AN'])

export function normalizeCeebKey(value: string): string {
  return value
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function expandCeebAbbreviations(value: string): string {
  let expanded = normalizeCeebKey(value)
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    expanded = expanded.replace(new RegExp(`\\b${abbr}\\b`, 'g'), full)
  }
  return expanded.replace(/\s+/g, ' ').trim()
}

export function normalizeCeebCode(value: string | number): string {
  const digits = String(value).replace(/\D/g, '')
  if (!digits || digits.length > 4) return ''
  return digits.padStart(4, '0')
}

export function lookupKeysForCollege(college: string): string[] {
  const keys = new Set<string>()
  const normalized = normalizeCeebKey(college)
  const expanded = expandCeebAbbreviations(college)
  if (normalized) keys.add(normalized)
  if (expanded) keys.add(expanded)

  const withoutCommunity = expanded
    .replace(/\bCOMMUNITY COLLEGE\b/g, 'COLLEGE')
    .replace(/\bCOMMUNITY\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (withoutCommunity) keys.add(withoutCommunity)

  return [...keys]
}

export function distinctiveTokens(value: string): string[] {
  return expandCeebAbbreviations(value)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

export function scoreCollegeNameMatch(query: string, candidate: string): number {
  const queryTokens = distinctiveTokens(query)
  if (queryTokens.length === 0) return 0

  const candidateTokens = new Set(distinctiveTokens(candidate))
  const matched = queryTokens.filter((token) => candidateTokens.has(token)).length
  return matched / queryTokens.length
}

export type CeebSchoolRecord = {
  name: string
  code: string
  city?: string
  state?: string
}

export function searchCeebInSchools(
  college: string,
  schools: CeebSchoolRecord[],
  options: { minScore?: number } = {},
): { code: string; name: string; score: number } | null {
  const minScore = options.minScore ?? 0.75

  for (const key of lookupKeysForCollege(college)) {
    const exact = schools.find((school) => expandCeebAbbreviations(school.name) === key)
    if (exact?.code) return { code: exact.code, name: exact.name, score: 1 }
  }

  let best: { code: string; name: string; score: number } | null = null
  for (const school of schools) {
    const score = scoreCollegeNameMatch(college, school.name)
    if (score > (best?.score ?? 0) && score >= minScore) {
      best = { code: school.code, name: school.name, score }
    }
  }

  return best
}

export function collegeBoardSlugVariants(name: string): string[] {
  const cleaned = name.replace(/&/g, ' and ')
  const base = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const variants = new Set<string>()
  if (base) variants.add(base)

  const simplified = cleaned
    .toLowerCase()
    .replace(/\bat\b/g, '')
    .replace(/\bthe\b/g, '')
    .replace(/\bof\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (simplified) variants.add(simplified)

  const withoutCommunity = base
    .replace(/-community-college$/, '-college')
    .replace(/-community-college-/, '-')
    .replace(/-technical-community-college$/, '-technical-college')
  if (withoutCommunity) variants.add(withoutCommunity)

  const technicalCollege = base.replace(/-community-college$/, '-technical-college')
  if (technicalCollege) variants.add(technicalCollege)

  return [...variants].filter(Boolean)
}
