import {
  loadBundledCeebLookup,
  normalizeCeeb,
  type CeebLookupMap,
} from '../../lib/ceebPrep'
import { searchCollegeCeebOnline } from '../../lib/ceebOnlineSearch'
import {
  lookupKeysForCollege,
  scoreCollegeNameMatch,
} from '../../lib/ceebSearchUtils'
import type { AppilyRow, ColumnMap, FieldChange } from '../types'
import { displayName, rowId } from './columns'

export type ProspectCeebChange = FieldChange & {
  college: string
  source: 'lookup' | 'online' | 'supplement' | 'padding' | 'unchanged'
}

export type ProspectCeebMissing = {
  rowIndex: number
  rowId: string
  name: string
  college: string
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

export async function applyProspectCeebCodes(
  rows: AppilyRow[],
  columns: ColumnMap,
  options: {
    useOnlineSearch?: boolean
    onProgress?: (done: number, total: number) => void
  } = {},
): Promise<{
  rows: AppilyRow[]
  changes: ProspectCeebChange[]
  stillMissing: ProspectCeebMissing[]
}> {
  const collegeField = columns.currentCollege
  const ceebField = columns.ceebCode
  if (!collegeField || !ceebField) {
    return { rows, changes: [], stillMissing: [] }
  }

  const { lookup, allSchools } = await loadBundledCeebLookup()
  const nextRows = rows.map((row) => ({ ...row }))
  const changes: ProspectCeebChange[] = []
  const stillMissing: ProspectCeebMissing[] = []
  const onlineTargets = new Map<string, number[]>()

  nextRows.forEach((row, rowIndex) => {
    const college = (row[collegeField] ?? '').trim()
    const before = (row[ceebField] ?? '').trim()
    let after = before ? normalizeCeeb(before) : ''
    let source: ProspectCeebChange['source'] = 'unchanged'

    if (!after && college) {
      const excelMatch = lookupInExcel(college, lookup) ?? fuzzyLookupInExcel(college, allSchools)
      if (excelMatch) {
        after = excelMatch
        source = 'lookup'
      } else if (options.useOnlineSearch) {
        const key = college.toLowerCase()
        const bucket = onlineTargets.get(key) ?? []
        bucket.push(rowIndex)
        onlineTargets.set(key, bucket)
      }
    } else if (before && after && before !== after) {
      source = 'padding'
    }

    row[ceebField] = after

    if (before !== after && after) {
      changes.push({
        rowIndex,
        rowId: rowId(row, columns, rowIndex),
        name: displayName(row, columns),
        field: ceebField,
        before,
        after,
        action:
          source === 'lookup'
            ? 'CEEB from reference'
            : source === 'padding'
              ? 'CEEB padded'
              : 'CEEB updated',
        college,
        source,
      })
    }
  })

  if (options.useOnlineSearch && onlineTargets.size > 0) {
    const entries = [...onlineTargets.entries()]
    let done = 0

    for (const [, rowIndexes] of entries) {
      const college = (nextRows[rowIndexes[0]][collegeField] ?? '').trim()
      const onlineResult = await searchCollegeCeebOnline(college)
      done++
      options.onProgress?.(done, entries.length)

      if (!onlineResult.code) continue

      for (const rowIndex of rowIndexes) {
        const row = nextRows[rowIndex]
        const before = (row[ceebField] ?? '').trim()
        if (before) continue

        row[ceebField] = onlineResult.code
        changes.push({
          rowIndex,
          rowId: rowId(row, columns, rowIndex),
          name: displayName(row, columns),
          field: ceebField,
          before,
          after: onlineResult.code,
          action: 'CEEB from College Board',
          college,
          source: onlineResult.source === 'supplement' ? 'supplement' : 'online',
        })
      }
    }
  }

  nextRows.forEach((row, rowIndex) => {
    const college = (row[collegeField] ?? '').trim()
    if (!college) return
    if (!(row[ceebField] ?? '').trim()) {
      stillMissing.push({
        rowIndex,
        rowId: rowId(row, columns, rowIndex),
        name: displayName(row, columns),
        college,
      })
    }
  })

  return { rows: nextRows, changes, stillMissing }
}
