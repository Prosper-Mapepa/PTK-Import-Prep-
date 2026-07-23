import type { AddressIssue, AppilyRow, ColumnMap, FieldChange } from '../types'
import { displayName, rowId } from './columns'

const UNIT_LABELS = [
  'apartment',
  'apt',
  'building',
  'bldg',
  'dept',
  'floor',
  'fl',
  'lot',
  'room',
  'rm',
  'space',
  'sp',
  'suite',
  'ste',
  'unit',
] as const

const UNIT_LABEL_PATTERN = UNIT_LABELS.map((label) => `\\b${label}\\b`).join('|')

const UNIT_SUFFIX = new RegExp(
  `\\s+((?:${UNIT_LABEL_PATTERN})\\.?\\s*#?\\s*[\\w/-]+|#\\s*[\\w/-]+)$`,
  'i',
)

const UNIT_PART = new RegExp(
  `^(?:(?:${UNIT_LABEL_PATTERN})\\.?\\s*#?\\s*[\\w/-]+|#\\s*[\\w/-]+)$`,
  'i',
)

const TRAILING_CITY_STATE_ZIP =
  /^(.+?)\s+([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/i

const TRAILING_STATE_ZIP = /\s*,?\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/i

const TRAILING_ZIP = /\s+(\d{5}(?:-\d{4})?)\s*$/i

const TRAILING_HOUSE_NUMBER = /^(.+?)\s+(\d+[A-Za-z]?)\s*$/i

const PO_BOX =
  /^(p\.?\s*o\.?\s*b\.?|po\s*b\.?|p\.?\s*o\.?\s*box|po\s*box|post\s*office\s*box)\b/i

const RURAL_PREFIX = /^[NSEW]\d+/i

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripLeadingJunk(address: string): string {
  return normalizeSpaces(address.replace(/^[^a-zA-Z0-9]+/, ''))
}

function isNumbersOnlyAddress(address: string): boolean {
  return /^\d+[A-Za-z]?$/.test(normalizeSpaces(address))
}

function isIncompletePoBoxAddress(address: string): boolean {
  const trimmed = normalizeSpaces(address)
  if (!PO_BOX.test(trimmed)) return false
  const rest = trimmed.replace(PO_BOX, '').trim()
  return !rest || !/\d/.test(rest)
}

function isIncompleteAddress1(address: string): boolean {
  const trimmed = normalizeSpaces(address)
  if (!trimmed) return false
  if (isNumbersOnlyAddress(trimmed)) return true
  if (isIncompletePoBoxAddress(trimmed)) return true
  return false
}

function isUnitOnlyAddress(address: string): boolean {
  const trimmed = normalizeSpaces(address)
  if (!trimmed) return true
  return trimmed
    .split(',')
    .map((part) => part.trim())
    .every((part) => UNIT_PART.test(part))
}

function sanitizeAddress2(address2: string): string {
  const trimmed = normalizeSpaces(address2)
  if (!trimmed) return ''
  return isUnitOnlyAddress(trimmed) ? trimmed : ''
}

function mergeAddress2(existing: string, unit: string): string {
  const current = existing.trim()
  const next = unit.trim()
  if (!current) return next
  if (!next) return current
  if (current.toLowerCase().includes(next.toLowerCase())) return current
  return `${current}, ${next}`
}

function extractUnit(address1: string): { street: string; unit: string } {
  const match = address1.match(UNIT_SUFFIX)
  if (!match) return { street: normalizeSpaces(address1), unit: '' }
  return {
    street: normalizeSpaces(address1.slice(0, match.index)),
    unit: normalizeSpaces(match[1]),
  }
}

function isPoBoxOrRural(address: string): boolean {
  return PO_BOX.test(address.trim()) || RURAL_PREFIX.test(address.trim())
}

function shouldClearAddress1(address: string): boolean {
  const trimmed = normalizeSpaces(address)
  if (!trimmed) return false
  if (isPoBoxOrRural(trimmed)) return false
  if (/^\d/.test(trimmed)) return false
  if (/^[^a-zA-Z0-9]/.test(trimmed)) return true
  if (/^[A-Za-z]{2,}/.test(trimmed)) return true
  return false
}

function startsWithNumber(address1: string): boolean {
  const trimmed = address1.trim()
  if (!trimmed) return false
  return /^\d/.test(trimmed) || isPoBoxOrRural(trimmed)
}

function reorderHouseNumber(address1: string): string {
  if (/^\d/.test(address1.trim()) || isPoBoxOrRural(address1)) return address1
  const match = address1.match(TRAILING_HOUSE_NUMBER)
  if (!match) return address1
  return normalizeSpaces(`${match[2]} ${match[1]}`)
}

function normalizeZipCode(zip: string): string {
  const digits = zip.replace(/[^\d-]/g, '')
  const match = digits.match(/^(\d{1,5})(-\d{4})?$/)
  if (!match) return zip.trim()
  const base = match[1].padStart(5, '0')
  return match[2] ? `${base}${match[2]}` : base
}

function extractTrailingLocation(
  address1: string,
  city: string,
  state: string,
  zip: string,
): { street: string; city: string; state: string; zip: string } {
  let street = address1
  let nextCity = city
  let nextState = state
  let nextZip = zip

  const full = street.match(TRAILING_CITY_STATE_ZIP)
  if (full) {
    street = normalizeSpaces(full[1])
    if (!nextCity) nextCity = normalizeSpaces(full[2])
    if (!nextState) nextState = full[3].toUpperCase()
    if (!nextZip) nextZip = full[4]
    return { street, city: nextCity, state: nextState, zip: nextZip }
  }

  const stateZip = street.match(TRAILING_STATE_ZIP)
  if (stateZip) {
    street = normalizeSpaces(street.slice(0, stateZip.index))
    if (!nextState) nextState = stateZip[1].toUpperCase()
    if (!nextZip) nextZip = stateZip[2]
  } else {
    const zipOnly = street.match(TRAILING_ZIP)
    if (zipOnly && !nextZip) {
      street = normalizeSpaces(street.slice(0, zipOnly.index))
      nextZip = zipOnly[1]
    }
  }

  return { street, city: nextCity, state: nextState, zip: nextZip }
}

export function cleanAddresses(
  rows: AppilyRow[],
  columns: ColumnMap,
): { rows: AppilyRow[]; changes: FieldChange[] } {
  if (!columns.address1) return { rows, changes: [] }

  const changes: FieldChange[] = []
  const nextRows = rows.map((row, rowIndex) => {
    const nextRow = { ...row }
    const id = rowId(row, columns, rowIndex)
    const name = displayName(row, columns)

    let address1 = stripLeadingJunk(row[columns.address1!] ?? '')
    let address2 = columns.address2 ? sanitizeAddress2(row[columns.address2] ?? '') : ''
    let city = columns.city ? (row[columns.city] ?? '').trim() : ''
    let state = columns.state ? (row[columns.state] ?? '').trim() : ''
    let zip = columns.zip ? (row[columns.zip] ?? '').trim() : ''

    const original = {
      address1: row[columns.address1!] ?? '',
      address2: columns.address2 ? (row[columns.address2] ?? '') : '',
      city: columns.city ? (row[columns.city] ?? '') : '',
      state: columns.state ? (row[columns.state] ?? '') : '',
      zip: columns.zip ? (row[columns.zip] ?? '') : '',
    }

    if (address1) {
      const unitSplit = extractUnit(address1)
      address1 = unitSplit.street
      address2 = mergeAddress2(address2, unitSplit.unit)

      const location = extractTrailingLocation(address1, city, state, zip)
      address1 = location.street
      city = location.city
      state = location.state
      zip = location.zip

      const reordered = reorderHouseNumber(address1)
      if (reordered !== address1) address1 = reordered
    }

    if (shouldClearAddress1(address1) || isIncompleteAddress1(address1)) {
      address1 = ''
    }

    const trailingUnit = extractUnit(address1)
    if (trailingUnit.unit) {
      address1 = trailingUnit.street
      address2 = mergeAddress2(address2, trailingUnit.unit)
    }

    address1 = normalizeSpaces(address1)
    address2 = sanitizeAddress2(normalizeSpaces(address2))
    zip = zip ? normalizeZipCode(zip) : zip

    nextRow[columns.address1!] = address1
    if (columns.address2) nextRow[columns.address2] = address2
    if (columns.city && city) nextRow[columns.city] = city
    if (columns.state && state) nextRow[columns.state] = state
    if (columns.zip && zip) nextRow[columns.zip] = zip

    const push = (field: string | null, before: string, after: string, action = 'Address cleaned') => {
      if (!field || before === after) return
      changes.push({ rowIndex, rowId: id, name, field, before, after, action })
    }

    push(columns.address1, original.address1, address1)
    push(columns.address2, original.address2, address2)
    push(columns.city, original.city, city)
    push(columns.state, original.state, state)
    push(columns.zip, original.zip, zip)

    return nextRow
  })

  return { rows: nextRows, changes }
}

export function findAddressIssues(rows: AppilyRow[], columns: ColumnMap): AddressIssue[] {
  if (!columns.address1) return []

  const issues: AddressIssue[] = []
  rows.forEach((row, rowIndex) => {
    const rowIssues: string[] = []
    const address1 = (row[columns.address1!] ?? '').trim()

    if (!address1) rowIssues.push('Missing address')
    else if (!startsWithNumber(address1)) rowIssues.push('Address does not start with a number')

    if (columns.city && !(row[columns.city] ?? '').trim()) rowIssues.push('Missing city')
    if (columns.state && !(row[columns.state] ?? '').trim()) rowIssues.push('Missing state')
    if (columns.zip && !(row[columns.zip] ?? '').trim()) rowIssues.push('Missing zip')

    const zip = columns.zip ? (row[columns.zip] ?? '').trim() : ''
    if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) rowIssues.push('Zip format may be invalid')

    if (rowIssues.length > 0) {
      issues.push({
        rowIndex,
        rowId: rowId(row, columns, rowIndex),
        name: displayName(row, columns),
        issues: rowIssues,
      })
    }
  })

  return issues
}

export function getAddressPreview(row: AppilyRow, columns: ColumnMap): string {
  return [columns.address1, columns.address2, columns.city, columns.state, columns.zip]
    .filter((field): field is string => Boolean(field))
    .map((field) => row[field]?.trim())
    .filter(Boolean)
    .join(', ')
}
