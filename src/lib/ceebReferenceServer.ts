import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import {
  collegeBoardSlugVariants,
  lookupKeysForCollege,
  normalizeCeebCode,
  searchCeebInSchools,
  type CeebSchoolRecord,
} from './ceebSearchUtils'

type CeebSearchSource = 'college-board' | 'excel' | 'supplement'

let cachedSchools: CeebSchoolRecord[] | null = null
let cachedSupplements: Map<string, string> | null = null

function referenceRoot(): string {
  return path.join(process.cwd(), 'public', 'reference')
}

function loadSchoolsFromExcel(): CeebSchoolRecord[] {
  const filePath = path.join(referenceRoot(), 'CEEB codes frequently missing.xlsx')
  const buffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, {
    defval: '',
    raw: false,
  })

  if (!rows.length) return []

  const headers = Object.keys(rows[0])
  const nameColumn =
    headers.find((header) => /school|college|institution|name/i.test(header)) ?? headers[0]
  const codeColumn = headers.find((header) => /ceeb/i.test(header)) ?? headers[1]

  return rows
    .map((row) => ({
      name: String(row[nameColumn] ?? ''),
      code: normalizeCeebCode(row[codeColumn] ?? ''),
      city: String(row.City ?? row.city ?? ''),
      state: String(row.State ?? row.state ?? ''),
    }))
    .filter((row) => row.name && row.code)
}

function loadSupplements(): Map<string, string> {
  const filePath = path.join(referenceRoot(), 'ceeb-supplements.json')
  if (!fs.existsSync(filePath)) return new Map()

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, string>
  const map = new Map<string, string>()
  for (const [name, code] of Object.entries(parsed)) {
    const normalized = normalizeCeebCode(code)
    if (!normalized) continue
    for (const key of lookupKeysForCollege(name)) {
      map.set(key, normalized)
    }
  }
  return map
}

function getSchools(): CeebSchoolRecord[] {
  if (!cachedSchools) cachedSchools = loadSchoolsFromExcel()
  return cachedSchools
}

function getSupplements(): Map<string, string> {
  if (!cachedSupplements) cachedSupplements = loadSupplements()
  return cachedSupplements
}

export function resetCeebReferenceCache() {
  cachedSchools = null
  cachedSupplements = null
}

async function fetchCollegeBoardCode(college: string): Promise<string | null> {
  for (const slug of collegeBoardSlugVariants(college)) {
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

function searchSupplements(college: string): string | null {
  const supplements = getSupplements()
  for (const key of lookupKeysForCollege(college)) {
    const found = supplements.get(key)
    if (found) return found
  }
  return null
}

export async function searchCollegeCeeb(
  college: string,
): Promise<{ code: string | null; source: CeebSearchSource | null }> {
  const boardCode = await fetchCollegeBoardCode(college)
  if (boardCode) return { code: boardCode, source: 'college-board' }

  const excelMatch = searchCeebInSchools(college, getSchools(), { minScore: 0.8 })
  if (excelMatch) return { code: excelMatch.code, source: 'excel' }

  const supplementCode = searchSupplements(college)
  if (supplementCode) return { code: supplementCode, source: 'supplement' }

  return { code: null, source: null }
}
