import type { ColumnMap } from '../types'

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

const ALIASES: Record<keyof ColumnMap, string[]> = {
  firstName: ['first_name', 'firstname', 'first', 'fname', 'student_first_name'],
  lastName: ['last_name', 'lastname', 'last', 'lname', 'student_last_name'],
  middleName: ['middle_name', 'middlename', 'middle', 'mname'],
  email: ['email_address', 'email', 'e_mail', 'student_email', 'personal_email'],
  address1: ['address_1', 'address1', 'address', 'street', 'street_address', 'street1'],
  address2: ['address_2', 'address2', 'street2', 'apt', 'apartment', 'unit'],
  city: ['city', 'town'],
  state: ['state_abbr', 'state', 'st', 'province'],
  zip: ['zip_code', 'zip', 'zipcode', 'postal_code', 'postal'],
  hsGradYear: [
    'high_school_grad_date',
    'hs_grad_date',
    'hs_grad_year',
    'high_school_grad_year',
    'hs_graduation_year',
    'graduation_year',
    'grad_year',
    'hsgraduationyear',
    'high_school_graduation_year',
  ],
  predictedStartTerm: [
    'predicted_start_term',
    'predicted_start',
    'start_term',
    'expected_start_term',
  ],
  id: ['student_id', 'cappex_id', 'appily_id', 'id', 'inquiry_id', 'email_address'],
}

export function resolveColumns(headers: string[]): ColumnMap {
  const byNormalized = new Map(headers.map((h) => [normalizeHeader(h), h]))

  const find = (keys: string[]): string | null => {
    for (const key of keys) {
      const match = byNormalized.get(key)
      if (match) return match
    }
    return null
  }

  return {
    firstName: find(ALIASES.firstName),
    lastName: find(ALIASES.lastName),
    middleName: find(ALIASES.middleName),
    email: find(ALIASES.email),
    address1: find(ALIASES.address1),
    address2: find(ALIASES.address2),
    city: find(ALIASES.city),
    state: find(ALIASES.state),
    zip: find(ALIASES.zip),
    hsGradYear: find(ALIASES.hsGradYear),
    predictedStartTerm: find(ALIASES.predictedStartTerm),
    id: find(ALIASES.id),
  }
}

export function displayName(row: Record<string, string>, columns: ColumnMap): string {
  const parts = [
    columns.firstName ? row[columns.firstName] : '',
    columns.lastName ? row[columns.lastName] : '',
  ].filter(Boolean)
  return parts.join(' ')
}

export function rowId(row: Record<string, string>, columns: ColumnMap, rowIndex: number): string {
  if (columns.id && row[columns.id]?.trim()) return row[columns.id].trim()
  return String(rowIndex + 1)
}

export function validateAppilyHeaders(columns: ColumnMap): void {
  const missing: string[] = []
  if (!columns.firstName) missing.push('first_name')
  if (!columns.lastName) missing.push('last_name')
  if (!columns.hsGradYear) missing.push('high_school_grad_date')
  if (!columns.predictedStartTerm) missing.push('predicted_start_term')

  if (missing.length > 0) {
    throw new Error(
      `Missing required Cappex columns: ${missing.join(', ')}. Check that this is an Appily Freshmen Inquiries file.`,
    )
  }
}
