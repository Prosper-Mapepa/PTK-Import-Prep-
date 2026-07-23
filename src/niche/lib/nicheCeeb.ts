import { loadBundledCeebLookup, type CeebLookupMap } from '../../lib/ceebPrep'
import { searchCollegeCeebOnline } from '../../lib/ceebOnlineSearch'
import { lookupKeysForCollege, scoreCollegeNameMatch } from '../../lib/ceebSearchUtils'
import type { NicheColumnMap, NicheFieldChange, NicheRow } from '../types'
import { nicheDisplayName, nicheRowId } from './columns'
import { normalizeCollegeCeebCode, normalizeHsCeebCode } from './nichePrep'

export type NicheCeebChange = NicheFieldChange & {
  school: string
  source: 'lookup' | 'online' | 'supplement' | 'padding'
}

export type NicheCeebMissing = {
  rowIndex: number
  rowId: string
  name: string
  school: string
}

function lookupInExcel(name: string, lookup: CeebLookupMap): string | null {
  for (const key of lookupKeysForCollege(name)) {
    const found = lookup.get(key)
    if (found) return found
  }
  return null
}

function fuzzyLookupInExcel(
  name: string,
  allSchools: { name: string; code: string }[],
): string | null {
  let bestCode: string | null = null
  let bestScore = 0
  for (const school of allSchools) {
    const score = scoreCollegeNameMatch(name, school.name)
    if (score > bestScore && score >= 0.8) {
      bestScore = score
      bestCode = school.code
    }
  }
  return bestCode
}

function toHsCeeb(code: string): string {
  // Reference/online may return 4-digit codes; pad HS codes to 6.
  const digits = code.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 4) return digits.padStart(6, '0')
  return digits.length <= 6 ? digits.padStart(6, '0') : ''
}

export async function applyNicheHighSchoolCeeb(
  rows: NicheRow[],
  columns: NicheColumnMap,
  options: {
    useOnlineSearch?: boolean
    onProgress?: (done: number, total: number) => void
  } = {},
): Promise<{
  rows: NicheRow[]
  changes: NicheCeebChange[]
  stillMissing: NicheCeebMissing[]
}> {
  const schoolField = columns.highSchoolName
  const ceebField = columns.highSchoolCeeb
  if (!ceebField) return { rows, changes: [], stillMissing: [] }

  const { lookup, allSchools } = await loadBundledCeebLookup()
  const nextRows = rows.map((row) => ({ ...row }))
  const changes: NicheCeebChange[] = []
  const stillMissing: NicheCeebMissing[] = []
  const onlineTargets = new Map<string, number[]>()

  nextRows.forEach((row, rowIndex) => {
    const school = schoolField ? (row[schoolField] ?? '').trim() : ''
    const before = (row[ceebField] ?? '').trim()
    let after = before ? normalizeHsCeebCode(before) : ''
    let source: NicheCeebChange['source'] | null = before && after && before !== after ? 'padding' : null

    if (!after && school) {
      const excelMatch = lookupInExcel(school, lookup) ?? fuzzyLookupInExcel(school, allSchools)
      if (excelMatch) {
        after = toHsCeeb(excelMatch)
        source = 'lookup'
      } else if (options.useOnlineSearch) {
        const key = school.toLowerCase()
        const bucket = onlineTargets.get(key) ?? []
        bucket.push(rowIndex)
        onlineTargets.set(key, bucket)
      }
    }

    row[ceebField] = after

    if (source && before !== after) {
      changes.push({
        rowIndex,
        rowId: nicheRowId(row, columns, rowIndex),
        name: nicheDisplayName(row, columns),
        field: ceebField,
        before,
        after,
        action:
          source === 'lookup'
            ? 'HS CEEB from reference'
            : source === 'padding'
              ? 'HS CEEB padded'
              : 'HS CEEB updated',
        school,
        source,
      })
    }
  })

  if (options.useOnlineSearch && onlineTargets.size > 0) {
    const entries = [...onlineTargets.entries()]
    let done = 0
    for (const [, rowIndexes] of entries) {
      const school = schoolField
        ? (nextRows[rowIndexes[0]][schoolField] ?? '').trim()
        : ''
      const onlineResult = await searchCollegeCeebOnline(school)
      done++
      options.onProgress?.(done, entries.length)
      if (!onlineResult.code) continue

      const after = toHsCeeb(onlineResult.code)
      if (!after) continue

      for (const rowIndex of rowIndexes) {
        const row = nextRows[rowIndex]
        const before = (row[ceebField] ?? '').trim()
        if (before) continue
        row[ceebField] = after
        changes.push({
          rowIndex,
          rowId: nicheRowId(row, columns, rowIndex),
          name: nicheDisplayName(row, columns),
          field: ceebField,
          before,
          after,
          action: 'HS CEEB from College Board',
          school,
          source: onlineResult.source === 'supplement' ? 'supplement' : 'online',
        })
      }
    }
  }

  nextRows.forEach((row, rowIndex) => {
    const school = schoolField ? (row[schoolField] ?? '').trim() : ''
    if (!(row[ceebField] ?? '').trim()) {
      stillMissing.push({
        rowIndex,
        rowId: nicheRowId(row, columns, rowIndex),
        name: nicheDisplayName(row, columns),
        school: school || '—',
      })
    }
  })

  return { rows: nextRows, changes, stillMissing }
}

export async function applyNicheCollegeCeeb(
  rows: NicheRow[],
  columns: NicheColumnMap,
  options: {
    useOnlineSearch?: boolean
    onProgress?: (done: number, total: number) => void
  } = {},
): Promise<{
  rows: NicheRow[]
  changes: NicheCeebChange[]
  stillMissing: NicheCeebMissing[]
}> {
  const collegeField = columns.collegeName
  const ceebField = columns.collegeCeeb
  if (!ceebField) return { rows, changes: [], stillMissing: [] }

  const { lookup, allSchools } = await loadBundledCeebLookup()
  const nextRows = rows.map((row) => ({ ...row }))
  const changes: NicheCeebChange[] = []
  const stillMissing: NicheCeebMissing[] = []
  const onlineTargets = new Map<string, number[]>()

  nextRows.forEach((row, rowIndex) => {
    const college = collegeField ? (row[collegeField] ?? '').trim() : ''
    const before = (row[ceebField] ?? '').trim()
    let after = before ? normalizeCollegeCeebCode(before) : ''
    let source: NicheCeebChange['source'] | null =
      before && after && before !== after ? 'padding' : null

    if (!after && college) {
      const excelMatch = lookupInExcel(college, lookup) ?? fuzzyLookupInExcel(college, allSchools)
      if (excelMatch) {
        after = normalizeCollegeCeebCode(excelMatch)
        source = 'lookup'
      } else if (options.useOnlineSearch) {
        const key = college.toLowerCase()
        const bucket = onlineTargets.get(key) ?? []
        bucket.push(rowIndex)
        onlineTargets.set(key, bucket)
      }
    }

    row[ceebField] = after

    if (source && before !== after) {
      changes.push({
        rowIndex,
        rowId: nicheRowId(row, columns, rowIndex),
        name: nicheDisplayName(row, columns),
        field: ceebField,
        before,
        after,
        action:
          source === 'lookup'
            ? 'College CEEB from reference'
            : source === 'padding'
              ? 'College CEEB padded'
              : 'College CEEB updated',
        school: college,
        source,
      })
    }
  })

  if (options.useOnlineSearch && onlineTargets.size > 0) {
    const entries = [...onlineTargets.entries()]
    let done = 0
    for (const [, rowIndexes] of entries) {
      const college = collegeField
        ? (nextRows[rowIndexes[0]][collegeField] ?? '').trim()
        : ''
      const onlineResult = await searchCollegeCeebOnline(college)
      done++
      options.onProgress?.(done, entries.length)
      if (!onlineResult.code) continue

      const after = normalizeCollegeCeebCode(onlineResult.code)
      if (!after) continue

      for (const rowIndex of rowIndexes) {
        const row = nextRows[rowIndex]
        const before = (row[ceebField] ?? '').trim()
        if (before) continue
        row[ceebField] = after
        changes.push({
          rowIndex,
          rowId: nicheRowId(row, columns, rowIndex),
          name: nicheDisplayName(row, columns),
          field: ceebField,
          before,
          after,
          action: 'College CEEB from College Board',
          school: college,
          source: onlineResult.source === 'supplement' ? 'supplement' : 'online',
        })
      }
    }
  }

  nextRows.forEach((row, rowIndex) => {
    const college = collegeField ? (row[collegeField] ?? '').trim() : ''
    if (college && !(row[ceebField] ?? '').trim()) {
      stillMissing.push({
        rowIndex,
        rowId: nicheRowId(row, columns, rowIndex),
        name: nicheDisplayName(row, columns),
        school: college,
      })
    }
  })

  return { rows: nextRows, changes, stillMissing }
}

export function padExistingNicheCeebAndZip(
  rows: NicheRow[],
  columns: NicheColumnMap,
): { rows: NicheRow[]; changes: NicheFieldChange[] } {
  const changes: NicheFieldChange[] = []
  const nextRows = rows.map((row, rowIndex) => {
    const nextRow = { ...row }

    if (columns.highSchoolCeeb) {
      const before = row[columns.highSchoolCeeb] ?? ''
      const after = before.trim() ? normalizeHsCeebCode(before) : ''
      if (before !== after) {
        nextRow[columns.highSchoolCeeb] = after
        changes.push({
          rowIndex,
          rowId: nicheRowId(row, columns, rowIndex),
          name: nicheDisplayName(row, columns),
          field: columns.highSchoolCeeb,
          before,
          after,
          action: 'HS CEEB padded',
        })
      }
    }

    if (columns.collegeCeeb) {
      const before = row[columns.collegeCeeb] ?? ''
      const after = before.trim() ? normalizeCollegeCeebCode(before) : ''
      if (before !== after) {
        nextRow[columns.collegeCeeb] = after
        changes.push({
          rowIndex,
          rowId: nicheRowId(row, columns, rowIndex),
          name: nicheDisplayName(row, columns),
          field: columns.collegeCeeb,
          before,
          after,
          action: 'College CEEB padded',
        })
      }
    }

    if (columns.zip) {
      const before = row[columns.zip] ?? ''
      const match = before.trim().match(/^(\d{1,5})(-\d{4})?$/)
      const after = match
        ? `${match[1].padStart(5, '0')}${match[2] ?? ''}`
        : before.trim()
      if (before !== after) {
        nextRow[columns.zip] = after
        changes.push({
          rowIndex,
          rowId: nicheRowId(row, columns, rowIndex),
          name: nicheDisplayName(row, columns),
          field: columns.zip,
          before,
          after,
          action: 'ZIP leading zero',
        })
      }
    }

    return nextRow
  })

  return { rows: nextRows, changes }
}
