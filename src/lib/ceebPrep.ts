import * as XLSX from 'xlsx'
import type { CeebChange, CeebStillMissing, PtkRow } from '../types'
import { CEEB_REFERENCE_PATH } from '../types'
import { clearOnlineCeebCache, searchCollegeCeebOnline } from './ceebOnlineSearch'
import {
  lookupKeysForCollege,
  normalizeCeebCode,
  scoreCollegeNameMatch,
} from './ceebSearchUtils'
import { parseWorkbookFile } from './fileUtils'

export type CeebLookupMap = Map<string, string>

export { normalizeCeebCode as normalizeCeeb }

export function isValidCeebValue(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length > 0 && digits.length <= 4
}

function pickColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const header of headers) {
    const lower = header.toLowerCase()
    if (patterns.some((pattern) => pattern.test(lower))) return header
  }
  return null
}

function onlineSourceToChangeSource(
  source: 'college-board' | 'excel' | 'supplement' | null,
): CeebChange['source'] {
  if (source === 'supplement') return 'supplement'
  if (source === 'excel') return 'lookup'
  return 'online'
}

export function buildCeebLookupFromRows(rows: Record<string, string>[]): {
  lookup: CeebLookupMap
  keyColumn: string
  valueColumn: string
} {
  if (rows.length === 0) {
    throw new Error('The CEEB reference file is empty.')
  }

  const headers = Object.keys(rows[0])
  const keyColumn =
    pickColumn(headers, [/school/, /college/, /institution/, /name/]) ?? headers[0]
  const valueColumn =
    pickColumn(headers, [/ceeb/]) ??
    headers.find((header) => header !== keyColumn) ??
    headers[1]

  if (!valueColumn) {
    throw new Error('Could not identify CEEB code column in the reference file.')
  }

  const lookup: CeebLookupMap = new Map()
  for (const row of rows) {
    const schoolName = String(row[keyColumn] ?? '')
    const value = normalizeCeebCode(String(row[valueColumn] ?? ''))
    if (!schoolName || !value) continue

    for (const key of lookupKeysForCollege(schoolName)) {
      if (!lookup.has(key)) lookup.set(key, value)
    }
  }

  return { lookup, keyColumn, valueColumn }
}

let cachedCeebLookup: {
  lookup: CeebLookupMap
  keyColumn: string
  valueColumn: string
  allSchools: { name: string; code: string }[]
} | null = null

export async function loadBundledCeebLookup(): Promise<{
  lookup: CeebLookupMap
  keyColumn: string
  valueColumn: string
  allSchools: { name: string; code: string }[]
}> {
  if (cachedCeebLookup) return cachedCeebLookup

  const response = await fetch(CEEB_REFERENCE_PATH)
  if (!response.ok) {
    throw new Error('Could not load CEEB codes frequently missing.xlsx from reference folder.')
  }

  const buffer = await response.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: '',
    raw: false,
  })

  const built = buildCeebLookupFromRows(rows)
  const allSchools = rows
    .map((row) => ({
      name: String(row[built.keyColumn] ?? ''),
      code: normalizeCeebCode(String(row[built.valueColumn] ?? '')),
    }))
    .filter((row) => row.name && row.code)

  cachedCeebLookup = { ...built, allSchools }
  return cachedCeebLookup
}

export async function loadCeebLookup(file: File): Promise<{
  lookup: CeebLookupMap
  keyColumn: string
  valueColumn: string
}> {
  const rows = await parseWorkbookFile(file)
  return buildCeebLookupFromRows(rows)
}

function lookupInExcel(college: string, lookup: CeebLookupMap): string | null {
  for (const key of lookupKeysForCollege(college)) {
    const found = lookup.get(key)
    if (found) return found
  }
  return null
}

function fuzzyLookupInExcel(
  college: string,
  allSchools: { name: string; code: string }[],
): string | null {
  let bestCode: string | null = null
  let bestScore = 0

  for (const school of allSchools) {
    const score = scoreCollegeNameMatch(college, school.name)
    if (score > bestScore && score >= 0.8) {
      bestScore = score
      bestCode = school.code
    }
  }

  return bestCode
}

function initialCeebValue(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return isValidCeebValue(trimmed) ? normalizeCeebCode(trimmed) : ''
}

export async function applyCeebPrep(
  rows: PtkRow[],
  lookup: CeebLookupMap,
  allSchools: { name: string; code: string }[] = [],
  options: { useOnlineSearch?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<{
  rows: PtkRow[]
  changes: CeebChange[]
  stillMissing: CeebStillMissing[]
}> {
  const nextRows = rows.map((row) => ({ ...row }))
  const changes: CeebChange[] = []
  const stillMissing: CeebStillMissing[] = []
  const onlineTargets = new Map<string, number[]>()

  nextRows.forEach((row, rowIndex) => {
    const before = (row.CEEB_CODE ?? '').trim()
    let after = initialCeebValue(before)
    let source: CeebChange['source'] = 'unchanged'

    if (!after) {
      const college = row['Current College'] ?? ''
      const excelMatch = lookupInExcel(college, lookup) ?? fuzzyLookupInExcel(college, allSchools)
      if (excelMatch) {
        after = excelMatch
        source = 'lookup'
      } else if (options.useOnlineSearch && college.trim()) {
        const key = college.trim().toLowerCase()
        const bucket = onlineTargets.get(key) ?? []
        bucket.push(rowIndex)
        onlineTargets.set(key, bucket)
      }
    } else if (before !== after) {
      source = 'padding'
    }

    row.CEEB_CODE = after

    if (before !== after && after) {
      changes.push({
        rowIndex,
        ptkId: row['Phi Theta Kappa ID'] ?? String(rowIndex + 1),
        college: row['Current College'] ?? '',
        before,
        after,
        source,
      })
    }
  })

  if (options.useOnlineSearch && onlineTargets.size > 0) {
    const entries = [...onlineTargets.entries()]
    let done = 0

    for (const [collegeKey, rowIndexes] of entries) {
      const college = nextRows[rowIndexes[0]]['Current College'] ?? collegeKey
      const onlineResult = await searchCollegeCeebOnline(college)
      done++
      options.onProgress?.(done, entries.length)

      if (!onlineResult.code) continue
      const changeSource = onlineSourceToChangeSource(onlineResult.source)

      for (const rowIndex of rowIndexes) {
        const row = nextRows[rowIndex]
        const before = (row.CEEB_CODE ?? '').trim()
        if (before) continue

        row.CEEB_CODE = onlineResult.code
        changes.push({
          rowIndex,
          ptkId: row['Phi Theta Kappa ID'] ?? String(rowIndex + 1),
          college: row['Current College'] ?? '',
          before,
          after: onlineResult.code,
          source: changeSource,
        })
      }
    }
  }

  nextRows.forEach((row, rowIndex) => {
    if (!(row.CEEB_CODE ?? '').trim()) {
      stillMissing.push({
        rowIndex,
        ptkId: row['Phi Theta Kappa ID'] ?? String(rowIndex + 1),
        college: row['Current College'] ?? '',
        ipedsId: row['IPEDS ID'] ?? '',
      })
    }
  })

  return { rows: nextRows, changes, stillMissing }
}

export function resetCeebCaches() {
  cachedCeebLookup = null
  clearOnlineCeebCache()
}
