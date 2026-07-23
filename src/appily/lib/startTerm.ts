import type { AppilyRow, ColumnMap, FieldChange } from '../types'
import { displayName, rowId } from './columns'

/**
 * Cappex provides high_school_grad_date (e.g. 6/1/2027).
 * Predicted start term is the next fall from that year → Fall 2027.
 */
export function fallTermFromGradValue(gradValue: string): string | null {
  const text = String(gradValue).trim()
  if (!text) return null

  // Prefer a trailing 4-digit year in date formats like 6/1/2027 or 2027-06-01
  const yearMatch =
    text.match(/(?:^|[^\d])((?:19|20)\d{2})(?:$|[^\d])/) || text.match(/^((?:19|20)\d{2})$/)
  if (!yearMatch) return null

  return `Fall ${yearMatch[1]}`
}

/**
 * Next upcoming Fall term from today.
 * Jan–Jul → Fall of current year; Aug–Dec → Fall of next year.
 */
export function getNextUpcomingFallTerm(now = new Date()): string {
  const year = now.getFullYear()
  const month = now.getMonth() // 0 = Jan
  return month < 7 ? `Fall ${year}` : `Fall ${year + 1}`
}

export function applyPredictedStartTerms(
  rows: AppilyRow[],
  columns: ColumnMap,
): { rows: AppilyRow[]; changes: FieldChange[] } {
  if (!columns.hsGradYear || !columns.predictedStartTerm) {
    return { rows, changes: [] }
  }

  const gradField = columns.hsGradYear
  const termField = columns.predictedStartTerm
  const changes: FieldChange[] = []

  const nextRows = rows.map((row, rowIndex) => {
    const gradValue = row[gradField] ?? ''
    const after = fallTermFromGradValue(gradValue)
    if (!after) return row

    const before = row[termField] ?? ''
    if (before === after) return row

    const nextRow = { ...row, [termField]: after }
    changes.push({
      rowIndex,
      rowId: rowId(row, columns, rowIndex),
      name: displayName(row, columns),
      field: termField,
      before,
      after,
      action: `From HS grad date ${gradValue.trim()}`,
    })
    return nextRow
  })

  return { rows: nextRows, changes }
}

/** Fill expected_transfer_term for every row with the next upcoming Fall. */
export function applyExpectedTransferTerms(
  rows: AppilyRow[],
  columns: ColumnMap,
  term = getNextUpcomingFallTerm(),
): { rows: AppilyRow[]; changes: FieldChange[]; term: string } {
  if (!columns.expectedTransferTerm) {
    return { rows, changes: [], term }
  }

  const termField = columns.expectedTransferTerm
  const changes: FieldChange[] = []

  const nextRows = rows.map((row, rowIndex) => {
    const before = row[termField] ?? ''
    if (before === term) return row

    const nextRow = { ...row, [termField]: term }
    changes.push({
      rowIndex,
      rowId: rowId(row, columns, rowIndex),
      name: displayName(row, columns),
      field: termField,
      before,
      after: term,
      action: 'Next upcoming Fall',
    })
    return nextRow
  })

  return { rows: nextRows, changes, term }
}
