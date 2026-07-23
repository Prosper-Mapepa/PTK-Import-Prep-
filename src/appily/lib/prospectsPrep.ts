import type { AppilyRow, ColumnMap, FieldChange } from '../types'
import { displayName, rowId } from './columns'
import { getNextUpcomingFallTerm } from './startTerm'

const CMU_COLLEGE =
  /\bcentral\s+michigan\b|\bcmich\b|\bcmu\b|central michigan university/i

export function isCmuCollege(collegeName: string): boolean {
  return CMU_COLLEGE.test(collegeName.trim())
}

export function removeCmuStudents(
  rows: AppilyRow[],
  columns: ColumnMap,
): { rows: AppilyRow[]; removed: AppilyRow[]; removedCount: number } {
  if (!columns.currentCollege) {
    return { rows, removed: [], removedCount: 0 }
  }

  const collegeField = columns.currentCollege
  const kept: AppilyRow[] = []
  const removed: AppilyRow[] = []

  for (const row of rows) {
    if (isCmuCollege(row[collegeField] ?? '')) removed.push(row)
    else kept.push(row)
  }

  return { rows: kept, removed, removedCount: removed.length }
}

export function insertCeebColumnAfterCollege(
  headers: string[],
  rows: AppilyRow[],
  columns: ColumnMap,
): { headers: string[]; rows: AppilyRow[]; columns: ColumnMap; ceebField: string } {
  const collegeField = columns.currentCollege
  if (!collegeField) {
    throw new Error('current_college_name column is required to insert CEEB Code.')
  }

  const ceebField = columns.ceebCode ?? 'ceeb_code'
  if (headers.includes(ceebField)) {
    return {
      headers,
      rows: rows.map((row) => ({ ...row, [ceebField]: row[ceebField] ?? '' })),
      columns: { ...columns, ceebCode: ceebField },
      ceebField,
    }
  }

  const collegeIndex = headers.indexOf(collegeField)
  const nextHeaders = [...headers]
  nextHeaders.splice(collegeIndex + 1, 0, ceebField)

  const nextRows = rows.map((row) => {
    const nextRow: AppilyRow = {}
    for (const header of nextHeaders) {
      nextRow[header] = header === ceebField ? '' : (row[header] ?? '')
    }
    return nextRow
  })

  return {
    headers: nextHeaders,
    rows: nextRows,
    columns: { ...columns, ceebCode: ceebField },
    ceebField,
  }
}

type Season = 'spring' | 'summer' | 'fall' | 'winter'

function parseTerm(value: string): { season: Season; year: number } | null {
  const match = value
    .trim()
    .match(/^(spring|summer|fall|winter)\s*((?:19|20)\d{2})$/i)
  if (!match) return null
  return {
    season: match[1].toLowerCase() as Season,
    year: Number(match[2]),
  }
}

/** True when the academic term has already ended relative to `now`. */
export function isTermInPast(value: string, now = new Date()): boolean {
  const parsed = parseTerm(value)
  if (!parsed) return false

  const { season, year } = parsed
  const end =
    season === 'spring'
      ? new Date(year, 5, 1) // June 1
      : season === 'summer'
        ? new Date(year, 8, 1) // Sept 1
        : season === 'fall'
          ? new Date(year + 1, 0, 1) // Jan 1 next year
          : new Date(year, 3, 1) // April 1 for winter

  return now >= end
}

export function applyProspectTransferTerms(
  rows: AppilyRow[],
  columns: ColumnMap,
  nextFall = getNextUpcomingFallTerm(),
  now = new Date(),
): { rows: AppilyRow[]; changes: FieldChange[]; term: string } {
  if (!columns.expectedTransferTerm) {
    return { rows, changes: [], term: nextFall }
  }

  const termField = columns.expectedTransferTerm
  const changes: FieldChange[] = []

  const nextRows = rows.map((row, rowIndex) => {
    const before = (row[termField] ?? '').trim()
    const needsUpdate = !before || isTermInPast(before, now)
    if (!needsUpdate) return row
    if (before === nextFall) return row

    const nextRow = { ...row, [termField]: nextFall }
    changes.push({
      rowIndex,
      rowId: rowId(row, columns, rowIndex),
      name: displayName(row, columns),
      field: termField,
      before,
      after: nextFall,
      action: before ? 'Past term → next Fall' : 'Blank → next Fall',
    })
    return nextRow
  })

  return { rows: nextRows, changes, term: nextFall }
}
