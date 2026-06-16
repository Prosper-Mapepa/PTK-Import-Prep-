import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { PtkRow } from '../types'

export async function parseImportFile(file: File): Promise<{
  headers: string[]
  rows: PtkRow[]
}> {
  const buffer = await file.arrayBuffer()
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv')) {
    return parseCsvText(new TextDecoder('utf-8').decode(buffer))
  }

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })

  if (raw.length === 0) {
    throw new Error('The uploaded file has no data rows.')
  }

  const headers = Object.keys(raw[0])
  const rows = raw.map((row) => stringifyRow(row, headers))
  return { headers, rows }
}

function parseCsvText(text: string): { headers: string[]; rows: PtkRow[] } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0]
    throw new Error(`CSV parsing error: ${firstError.message}`)
  }

  if (!parsed.meta.fields?.length || parsed.data.length === 0) {
    throw new Error('The CSV file must include a header row and at least one data row.')
  }

  const headers = parsed.meta.fields
  const rows = parsed.data.map((row) => stringifyRow(row, headers))
  return { headers, rows }
}

function stringifyRow(row: Record<string, unknown>, headers: string[]): PtkRow {
  const result: PtkRow = {}
  for (const header of headers) {
    const value = row[header]
    result[header] = value == null ? '' : String(value).trim()
  }
  return result
}

export function validatePtkHeaders(headers: string[], campusType: 'main' | 'online'): void {
  const required = [
    'Phi Theta Kappa ID',
    'Address 1',
    'City',
    'State',
    'Zip Code',
    'Current College',
    'CEEB_CODE',
    'Expected Graduation Date',
  ]

  if (campusType === 'main') {
    required.push('Current Major Code')
  }

  const missing = required.filter((column) => !headers.includes(column))
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}`)
  }
}

export function detectCampusType(fileName: string): 'main' | 'online' | null {
  const lower = fileName.toLowerCase()
  if (lower.includes('main campus') || lower.includes('main_campus')) return 'main'
  if (
    lower.includes('online') ||
    lower.includes('global campus') ||
    lower.includes('cmu online')
  ) {
    return 'online'
  }
  return null
}

export function extractStartTerm(fileName: string): string {
  const match = fileName.match(/(?:spring|summer|fall|winter)\s+\d{4}/i)
  return match ? match[0].replace(/\s+/g, ' ').trim() : ''
}

export function insertColumnAfter(
  headers: string[],
  rows: PtkRow[],
  afterColumn: string,
  newColumn: string,
  getValue: (row: PtkRow, index: number) => string,
): { headers: string[]; rows: PtkRow[] } {
  if (headers.includes(newColumn)) {
    const nextRows = rows.map((row, index) => ({
      ...row,
      [newColumn]: getValue(row, index),
    }))
    return { headers, rows: nextRows }
  }

  const anchorIndex = headers.indexOf(afterColumn)
  if (anchorIndex === -1) {
    throw new Error(`Column "${afterColumn}" was not found in the file.`)
  }

  const nextHeaders = [...headers]
  nextHeaders.splice(anchorIndex + 1, 0, newColumn)

  const nextRows = rows.map((row, index) => {
    const nextRow: PtkRow = {}
    for (const header of nextHeaders) {
      if (header === newColumn) {
        nextRow[header] = getValue(row, index)
      } else {
        nextRow[header] = row[header] ?? ''
      }
    }
    return nextRow
  })

  return { headers: nextHeaders, rows: nextRows }
}

export function rowsToCsv(headers: string[], rows: PtkRow[]): string {
  const escape = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(',')),
  ]
  return lines.join('\r\n')
}

export function downloadTextFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export async function parseWorkbookFile(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: '',
    raw: false,
  })
}
