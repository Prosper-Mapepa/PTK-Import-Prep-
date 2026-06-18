import type { AddressCleanChange, PtkRow } from '../types'
import { fixTextEncoding, isNameField } from './textEncoding'

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
      const after = fixTextEncoding(before)
      if (before !== after) {
        nextRow[field] = after
        changes.push({
          rowIndex,
          ptkId,
          name: displayName,
          field,
          before,
          after,
          action: 'Encoding fixed',
        })
      }
    }

    return nextRow
  })

  return { rows: nextRows, changes }
}
