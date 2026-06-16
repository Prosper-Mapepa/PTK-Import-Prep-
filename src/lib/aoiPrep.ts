import * as XLSX from 'xlsx'
import type { PtkRow } from '../types'
import { CROSSWALK_PATH } from '../types'

type CrosswalkEntry = {
  input: string
  aoiName: string
}

let cachedCrosswalk: CrosswalkEntry[] | null = null

function normalizeMajorCode(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const numeric = Number(trimmed)
  if (!Number.isNaN(numeric)) return String(numeric)
  return trimmed
}

export async function loadCrosswalk(): Promise<CrosswalkEntry[]> {
  if (cachedCrosswalk) return cachedCrosswalk

  const response = await fetch(CROSSWALK_PATH)
  if (!response.ok) {
    throw new Error('Could not load the AOI crosswalk file.')
  }

  const buffer = await response.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })

  cachedCrosswalk = rows
    .map((row) => ({
      input: normalizeMajorCode(String(row.Input ?? '')),
      aoiName: String(row['AOI Name'] ?? '').trim(),
    }))
    .filter((row) => row.input && row.aoiName)

  return cachedCrosswalk
}

export function buildAoiLookup(crosswalk: CrosswalkEntry[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of crosswalk) {
    map.set(entry.input, entry.aoiName)
  }
  return map
}

export function mapAoiForRow(
  row: PtkRow,
  lookup: Map<string, string>,
): { value: string; matched: boolean } {
  const majorCode = normalizeMajorCode(row['Current Major Code'] ?? '')
  if (!majorCode) return { value: '', matched: false }

  const direct = lookup.get(majorCode)
  if (direct) return { value: direct, matched: true }

  return { value: '', matched: false }
}

export function applyAoiColumn(
  headers: string[],
  rows: PtkRow[],
  lookup: Map<string, string>,
): {
  headers: string[]
  rows: PtkRow[]
  mapped: number
  unmapped: number
} {
  const anchorIndex = headers.indexOf('Current Major Code')
  if (anchorIndex === -1) {
    throw new Error('Column "Current Major Code" was not found in the file.')
  }

  const nextHeaders = [...headers]
  if (!nextHeaders.includes('CMU AOI')) {
    nextHeaders.splice(anchorIndex + 1, 0, 'CMU AOI')
  }

  let mapped = 0
  let unmapped = 0

  const nextRows = rows.map((row) => {
    const nextRow: PtkRow = {}
    const { value, matched } = mapAoiForRow(row, lookup)
    if (matched) mapped++
    else if ((row['Current Major Code'] ?? '').trim()) unmapped++

    for (const header of nextHeaders) {
      if (header === 'CMU AOI') {
        nextRow[header] = row['CMU AOI']?.trim() ? row['CMU AOI'] : value
      } else {
        nextRow[header] = row[header] ?? ''
      }
    }
    return nextRow
  })

  return { headers: nextHeaders, rows: nextRows, mapped, unmapped }
}
