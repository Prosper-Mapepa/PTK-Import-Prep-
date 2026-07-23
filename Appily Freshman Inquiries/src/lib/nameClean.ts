import type { AppilyRow, ColumnMap, FieldChange } from '../types'
import { displayName, rowId } from './columns'
import { hasNonAsciiNameChars, sanitizeNameChars } from './textEncoding'

export function cleanNames(
  rows: AppilyRow[],
  columns: ColumnMap,
): { rows: AppilyRow[]; changes: FieldChange[] } {
  const nameFields = [columns.firstName, columns.lastName, columns.middleName].filter(
    (field): field is string => Boolean(field),
  )
  if (nameFields.length === 0) return { rows, changes: [] }

  const changes: FieldChange[] = []
  const nextRows = rows.map((row, rowIndex) => {
    const nextRow = { ...row }
    const id = rowId(row, columns, rowIndex)
    const name = displayName(row, columns)

    for (const field of nameFields) {
      const before = row[field] ?? ''
      if (!hasNonAsciiNameChars(before)) continue

      const after = sanitizeNameChars(before)
      if (before !== after) {
        nextRow[field] = after
        changes.push({
          rowIndex,
          rowId: id,
          name,
          field,
          before,
          after,
          action: 'Accents removed',
        })
      }
    }

    return nextRow
  })

  return { rows: nextRows, changes }
}
