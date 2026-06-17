import type { AddressCleanChange, PtkRow } from '../types'
import type { SmartyValidationResult } from './smartyValidation'

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

function stripLeadingJunk(address: string): string {
  return normalizeSpaces(address.replace(/^[^a-zA-Z0-9]+/, ''))
}

export function isNumbersOnlyAddress(address: string): boolean {
  const trimmed = normalizeSpaces(address)
  return /^\d+[A-Za-z]?$/.test(trimmed)
}

export function isIncompletePoBoxAddress(address: string): boolean {
  const trimmed = normalizeSpaces(address)
  if (!PO_BOX.test(trimmed)) return false

  const rest = trimmed.replace(PO_BOX, '').trim()
  if (!rest) return true
  if (!/\d/.test(rest)) return true

  return false
}

export function isIncompleteAddress1(address: string): boolean {
  const trimmed = normalizeSpaces(address)
  if (!trimmed) return false
  if (isNumbersOnlyAddress(trimmed)) return true
  if (isIncompletePoBoxAddress(trimmed)) return true
  return false
}

export function isUnitOnlyAddress(address: string): boolean {
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

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractUnit(address1: string): { street: string; unit: string } {
  const match = address1.match(UNIT_SUFFIX)
  if (!match) return { street: normalizeSpaces(address1), unit: '' }
  return {
    street: normalizeSpaces(address1.slice(0, match.index)),
    unit: normalizeSpaces(match[1]),
  }
}

function extractTrailingLocation(address1: string, row: PtkRow): {
  street: string
  city: string
  state: string
  zip: string
} {
  let street = address1
  let city = row.City?.trim() ?? ''
  let state = row.State?.trim() ?? ''
  let zip = row['Zip Code']?.trim() ?? ''

  const fullMatch = street.match(TRAILING_CITY_STATE_ZIP)
  if (fullMatch) {
    street = normalizeSpaces(fullMatch[1])
    city = city || fullMatch[2].trim()
    state = state || fullMatch[3].trim()
    zip = zip || fullMatch[4].trim()
    return { street, city, state, zip }
  }

  const stateZipMatch = street.match(TRAILING_STATE_ZIP)
  if (stateZipMatch) {
    const candidateState = stateZipMatch[1].trim()
    const beforeState = street.slice(0, stateZipMatch.index).trim()
    const looksLikeStreetState =
      /(?:^|\s)(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)-\d+/i.test(
        beforeState,
      )
    if (!looksLikeStreetState) {
      street = normalizeSpaces(beforeState)
      state = state || candidateState
      zip = zip || stateZipMatch[2].trim()
      return { street, city, state, zip }
    }
  }

  const zipMatch = street.match(TRAILING_ZIP)
  if (zipMatch) {
    street = normalizeSpaces(street.slice(0, zipMatch.index))
    zip = zip || zipMatch[1].trim()
  }

  return { street, city, state, zip }
}

function reorderHouseNumber(address1: string): string {
  if (/^\d/.test(address1) || PO_BOX.test(address1) || RURAL_PREFIX.test(address1)) {
    return address1
  }

  const match = address1.match(TRAILING_HOUSE_NUMBER)
  if (!match) return address1

  const streetName = match[1].trim()
  const houseNumber = match[2].trim()
  if (!streetName || !houseNumber) return address1

  return `${houseNumber} ${streetName}`
}

export function normalizeZipCode(zip: string): string {
  const trimmed = zip.trim()
  if (!trimmed) return ''

  const match = trimmed.match(/^(\d{1,5})(-\d{4})?$/)
  if (!match) return trimmed

  const base = match[1].padStart(5, '0')
  return match[2] ? `${base}${match[2]}` : base
}

export function isPoBoxOrRural(address: string): boolean {
  return PO_BOX.test(address.trim()) || RURAL_PREFIX.test(address.trim())
}

export function shouldClearAddress1(address: string): boolean {
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

export function cleanAddressRow(row: PtkRow, rowIndex: number): {
  row: PtkRow
  changes: AddressCleanChange[]
} {
  const changes: AddressCleanChange[] = []
  const nextRow: PtkRow = { ...row }
  const ptkId = row['Phi Theta Kappa ID'] ?? String(rowIndex + 1)
  const name = [row['First Name'], row['Last Name']].filter(Boolean).join(' ')

  let address1 = stripLeadingJunk(row['Address 1']?.trim() ?? '')
  let address2 = sanitizeAddress2(row['Address 2'] ?? '')

  const original = {
    address1: row['Address 1'] ?? '',
    address2: row['Address 2'] ?? '',
    city: row.City ?? '',
    state: row.State ?? '',
    zip: row['Zip Code'] ?? '',
  }

  let city = row.City?.trim() ?? ''
  let state = row.State?.trim() ?? ''
  let zip = row['Zip Code']?.trim() ?? ''

  if (address1) {
    const unitSplit = extractUnit(address1)
    address1 = unitSplit.street
    address2 = mergeAddress2(address2, unitSplit.unit)

    const locationSplit = extractTrailingLocation(address1, nextRow)
    address1 = locationSplit.street
    city = locationSplit.city || city
    state = locationSplit.state || state
    zip = locationSplit.zip || zip

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

  nextRow['Address 1'] = address1
  nextRow['Address 2'] = address2
  if (city) nextRow.City = city
  if (state) nextRow.State = state
  if (zip) nextRow['Zip Code'] = zip

  const recordChange = (field: string, before: string, after: string) => {
    if (before !== after) {
      changes.push({ rowIndex, ptkId, name, field, before, after, action: '' })
    }
  }

  recordChange('Address 1', original.address1, nextRow['Address 1'])
  recordChange('Address 2', original.address2, nextRow['Address 2'])
  recordChange('City', original.city, nextRow.City ?? '')
  recordChange('State', original.state, nextRow.State ?? '')
  recordChange('Zip Code', original.zip, nextRow['Zip Code'] ?? '')

  return { row: nextRow, changes }
}

export function cleanAddresses(rows: PtkRow[]): {
  rows: PtkRow[]
  changes: AddressCleanChange[]
} {
  const changes: AddressCleanChange[] = []
  const cleanedRows = rows.map((row, rowIndex) => {
    const result = cleanAddressRow(row, rowIndex)
    const zip = result.row['Zip Code']?.trim() ?? ''
    const normalizedZip = normalizeZipCode(zip)
    if (normalizedZip && normalizedZip !== zip) {
      const ptkId = result.row['Phi Theta Kappa ID'] ?? String(rowIndex + 1)
      const name = [result.row['First Name'], result.row['Last Name']].filter(Boolean).join(' ')
      result.changes.push({
        rowIndex,
        ptkId,
        name,
        field: 'Zip Code',
        before: zip,
        after: normalizedZip,
        action: '',
      })
      result.row['Zip Code'] = normalizedZip
    }
    changes.push(...result.changes)
    return result.row
  })
  return { rows: cleanedRows, changes }
}

export function addressNeedsReview(row: PtkRow): string[] {
  const issues: string[] = []
  const address1 = row['Address 1']?.trim() ?? ''

  if (!address1) issues.push('Missing Address 1')
  else if (!startsWithNumber(address1)) issues.push('Address 1 does not start with a number')

  if (!row.City?.trim()) issues.push('Missing City')
  if (!row.State?.trim()) issues.push('Missing State')
  if (!row['Zip Code']?.trim()) issues.push('Missing Zip Code')

  const zip = row['Zip Code']?.trim() ?? ''
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
    issues.push('Zip Code format may be invalid')
  }

  return issues
}

export function applySmartyStandardization(
  rows: PtkRow[],
  validations: { rowIndex: number; valid: boolean; standardized?: SmartyValidationResult['standardized'] }[],
): { rows: PtkRow[]; changes: AddressCleanChange[] } {
  const changes: AddressCleanChange[] = []
  const nextRows = rows.map((row) => ({ ...row }))

  for (const validation of validations) {
    if (!validation.valid || !validation.standardized) continue

    const row = nextRows[validation.rowIndex]
    const std = validation.standardized
    const ptkId = row['Phi Theta Kappa ID'] ?? String(validation.rowIndex + 1)
    const name = [row['First Name'], row['Last Name']].filter(Boolean).join(' ')

    const beforeRow = {
      'Address 1': row['Address 1'] ?? '',
      'Address 2': row['Address 2'] ?? '',
      City: row.City ?? '',
      State: row.State ?? '',
      'Zip Code': row['Zip Code'] ?? '',
    }

    row['Address 1'] = std.address1
    row['Address 2'] = std.address2
    row.City = std.city
    row.State = std.state
    row['Zip Code'] = std.zip

    let address1 = stripLeadingJunk(row['Address 1']?.trim() ?? '')
    let address2 = sanitizeAddress2(row['Address 2'] ?? '')

    const unitSplit = extractUnit(address1)
    address1 = unitSplit.street
    address2 = mergeAddress2(address2, unitSplit.unit)

    if (shouldClearAddress1(address1) || isIncompleteAddress1(address1)) {
      address1 = ''
    }

    const trailingUnit = extractUnit(address1)
    if (trailingUnit.unit) {
      address1 = trailingUnit.street
      address2 = mergeAddress2(address2, trailingUnit.unit)
    }

    row['Address 1'] = normalizeSpaces(address1)
    row['Address 2'] = sanitizeAddress2(normalizeSpaces(address2))

    for (const field of ['Address 1', 'Address 2', 'City', 'State', 'Zip Code'] as const) {
      const before = beforeRow[field]
      const after = row[field] ?? ''
      if (before !== after) {
        changes.push({
          rowIndex: validation.rowIndex,
          ptkId,
          name,
          field,
          before,
          after,
          action: 'Smarty verified',
        })
      }
    }
  }

  return { rows: nextRows, changes }
}
