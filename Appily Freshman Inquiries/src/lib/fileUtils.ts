import Papa from 'papaparse'
import type { AppilyRow } from '../types'

export async function parseImportFile(file: File): Promise<{
  headers: string[]
  rows: AppilyRow[]
}> {
  const buffer = await file.arrayBuffer()
  const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '')
  return parseCsvText(text)
}

function parseCsvText(text: string): { headers: string[]; rows: AppilyRow[] } {
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

function stringifyRow(row: Record<string, unknown>, headers: string[]): AppilyRow {
  const result: AppilyRow = {}
  for (const header of headers) {
    const value = row[header]
    result[header] = value == null ? '' : String(value).trim()
  }
  return result
}

export function isCappexFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.includes('cappex') || lower.includes('central_michigan_university_169248')
}

export function rowsToCsv(headers: string[], rows: AppilyRow[]): string {
  const escape = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(',')),
  ]
  return `\uFEFF${lines.join('\r\n')}`
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
