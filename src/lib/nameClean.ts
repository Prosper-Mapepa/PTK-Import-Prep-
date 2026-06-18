import type { AddressCleanChange, PtkRow } from '../types'
import { hasNonAsciiNameChars, isNameField, sanitizeNameChars } from './textEncoding'

export function cleanNames(rows: PtkRow[], headers: string[]): {
  rows: PtkRow[]
  changes: AddressCleanChange[]
} {
  const nameFields = headers.filter(isNameField)
  if (nameFields.length === 0) {
    return { rows, changes: [] }
  }

  const changes: AddressCleanChange[] = []
  const nextRows = rows.map((row, rowIndex) => {
    const nextRow = { ...row }
    const ptkId = row['Phi Theta Kappa ID'] ?? String(rowIndex + 1)
    const displayName = [row['First Name'], row['Last Name']].filter(Boolean).join(' ')

    for (const field of nameFields) {
      const before = row[field] ?? ''
      if (!hasNonAsciiNameChars(before)) continue

      const after = sanitizeNameChars(before)
      if (before !== after) {
        nextRow[field] = after
        changes.push({
          rowIndex,
          ptkId,
          name: displayName,
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
