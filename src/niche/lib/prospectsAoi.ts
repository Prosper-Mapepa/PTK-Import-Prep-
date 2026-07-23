import { buildAoiLookup, loadCrosswalk } from '../../lib/aoiPrep'
import type { NicheColumnMap, NicheFieldChange, NicheRow } from '../types'
import { nicheDisplayName, nicheRowId } from './columns'

function normalizeMajorCode(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const numeric = Number(trimmed)
  if (!Number.isNaN(numeric)) return String(numeric)
  return trimmed
}

/**
 * Insert "CMU AOI" after MajorCIP and fill from the 2025 MajorCIP → AOI crosswalk.
 */
export async function applyNicheProspectsAoi(
  headers: string[],
  rows: NicheRow[],
  columns: NicheColumnMap,
): Promise<{
  headers: string[]
  rows: NicheRow[]
  columns: NicheColumnMap
  mapped: number
  unmapped: number
  changes: NicheFieldChange[]
}> {
  const cipField = columns.majorCip
  if (!cipField) {
    throw new Error('MajorCIP column is required to add CMU AOI.')
  }

  const crosswalk = await loadCrosswalk()
  const lookup = buildAoiLookup(crosswalk)
  const aoiField = columns.cmuAoi ?? 'CMU AOI'

  const nextHeaders = [...headers]
  if (!nextHeaders.includes(aoiField)) {
    const cipIndex = nextHeaders.indexOf(cipField)
    nextHeaders.splice(cipIndex + 1, 0, aoiField)
  }

  let mapped = 0
  let unmapped = 0
  const changes: NicheFieldChange[] = []

  const nextRows = rows.map((row, rowIndex) => {
    const nextRow: NicheRow = {}
    const cip = normalizeMajorCode(row[cipField] ?? '')
    const before = (row[aoiField] ?? '').trim()
    const lookedUp = cip ? lookup.get(cip) ?? '' : ''
    const after = before || lookedUp

    if (lookedUp) mapped++
    else if (cip) unmapped++

    for (const header of nextHeaders) {
      if (header === aoiField) nextRow[header] = after
      else nextRow[header] = row[header] ?? ''
    }

    if (!before && after) {
      changes.push({
        rowIndex,
        rowId: nicheRowId(row, columns, rowIndex),
        name: nicheDisplayName(row, columns),
        field: aoiField,
        before,
        after,
        action: `From MajorCIP ${cip}`,
      })
    }

    return nextRow
  })

  return {
    headers: nextHeaders,
    rows: nextRows,
    columns: { ...columns, cmuAoi: aoiField },
    mapped,
    unmapped,
    changes,
  }
}
