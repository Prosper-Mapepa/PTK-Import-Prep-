import type { NicheColumnMap } from '../types'

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

const ALIASES: Record<keyof NicheColumnMap, string[]> = {
  firstName: ['firstname', 'first_name', 'first'],
  lastName: ['lastname', 'last_name', 'last'],
  email: ['email', 'email_address', 'e_mail'],
  address1: ['address', 'address_1', 'address1', 'street'],
  address2: ['address_2', 'address2'],
  city: ['city'],
  state: ['state', 'state_abbr'],
  zip: ['zipcode', 'zip_code', 'zip'],
  highSchoolName: ['highschoolname', 'high_school_name', 'hs_name'],
  highSchoolCeeb: ['highschoolceeb', 'high_school_ceeb', 'hs_ceeb'],
  collegeName: ['collegename', 'college_name', 'current_college_name'],
  collegeCeeb: ['collegeceeb', 'college_ceeb'],
  prospectiveType: ['prospectivetype', 'prospective_type', 'student_type'],
  transferEnrollmentDate: [
    'transferenrollmentdate',
    'transfer_enrollment_date',
    'enrollment_date',
  ],
  intendedTransferDate: [
    'intendedtransferdate',
    'intended_transfer_date',
    'transfer_date',
  ],
  majorCip: ['majorcip', 'major_cip', 'cip'],
  cmuAoi: ['cmu_aoi', 'cmuaoi', 'aoi'],
}

export function resolveNicheColumns(headers: string[]): NicheColumnMap {
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
    email: find(ALIASES.email),
    address1: find(ALIASES.address1),
    address2: find(ALIASES.address2),
    city: find(ALIASES.city),
    state: find(ALIASES.state),
    zip: find(ALIASES.zip),
    highSchoolName: find(ALIASES.highSchoolName),
    highSchoolCeeb: find(ALIASES.highSchoolCeeb),
    collegeName: find(ALIASES.collegeName),
    collegeCeeb: find(ALIASES.collegeCeeb),
    prospectiveType: find(ALIASES.prospectiveType),
    transferEnrollmentDate: find(ALIASES.transferEnrollmentDate),
    intendedTransferDate: find(ALIASES.intendedTransferDate),
    majorCip: find(ALIASES.majorCip),
    cmuAoi: find(ALIASES.cmuAoi),
  }
}

export function nicheDisplayName(row: Record<string, string>, columns: NicheColumnMap): string {
  return [columns.firstName ? row[columns.firstName] : '', columns.lastName ? row[columns.lastName] : '']
    .filter(Boolean)
    .join(' ')
}

export function nicheRowId(row: Record<string, string>, columns: NicheColumnMap, rowIndex: number): string {
  if (columns.email && row[columns.email]?.trim()) return row[columns.email].trim()
  return String(rowIndex + 1)
}

export function validateNicheFreshmanHeaders(columns: NicheColumnMap): void {
  const missing: string[] = []
  if (!columns.firstName) missing.push('FirstName')
  if (!columns.lastName) missing.push('LastName')
  if (!columns.email) missing.push('Email')
  if (!columns.prospectiveType) missing.push('ProspectiveType')
  if (!columns.highSchoolCeeb) missing.push('HighSchoolCEEB')

  if (missing.length > 0) {
    throw new Error(
      `Missing required Niche columns: ${missing.join(', ')}. Check that this is a Niche Freshman Inquiries file.`,
    )
  }
}

export function validateNicheTransferHeaders(columns: NicheColumnMap): void {
  const missing: string[] = []
  if (!columns.firstName) missing.push('FirstName')
  if (!columns.lastName) missing.push('LastName')
  if (!columns.email) missing.push('Email')
  if (!columns.collegeName) missing.push('CollegeName')
  if (!columns.collegeCeeb) missing.push('CollegeCEEB')
  if (!columns.transferEnrollmentDate) missing.push('TransferEnrollmentDate')

  if (missing.length > 0) {
    throw new Error(
      `Missing required Niche columns: ${missing.join(', ')}. Check that this is a Niche Transfer Inquiries file.`,
    )
  }
}

export function validateNicheProspectsHeaders(columns: NicheColumnMap): void {
  const missing: string[] = []
  if (!columns.firstName) missing.push('FirstName')
  if (!columns.lastName) missing.push('LastName')
  if (!columns.email) missing.push('Email')
  if (!columns.majorCip) missing.push('MajorCIP')
  if (!columns.highSchoolCeeb) missing.push('HighSchoolCEEB')

  if (missing.length > 0) {
    throw new Error(
      `Missing required Niche columns: ${missing.join(', ')}. Check that this is a Niche Freshman Prospects file.`,
    )
  }
}

export function validateNicheTransferProspectsHeaders(columns: NicheColumnMap): void {
  const missing: string[] = []
  if (!columns.firstName) missing.push('FirstName')
  if (!columns.lastName) missing.push('LastName')
  if (!columns.email) missing.push('Email')
  if (!columns.majorCip) missing.push('MajorCIP')
  if (!columns.collegeName) missing.push('CollegeName')
  if (!columns.collegeCeeb) missing.push('CollegeCEEB')
  if (!columns.intendedTransferDate) missing.push('IntendedTransferDate')

  if (missing.length > 0) {
    throw new Error(
      `Missing required Niche columns: ${missing.join(', ')}. Check that this is a Niche Transfer Prospects file.`,
    )
  }
}

/** Map Niche columns onto the shared Appily cleaner ColumnMap shape. */
export function toAppilyColumnMap(columns: NicheColumnMap) {
  return {
    firstName: columns.firstName,
    lastName: columns.lastName,
    middleName: null,
    email: columns.email,
    address1: columns.address1,
    address2: columns.address2,
    city: columns.city,
    state: columns.state,
    zip: columns.zip,
    hsGradYear: null,
    predictedStartTerm: null,
    expectedTransferTerm: null,
    currentCollege: columns.collegeName,
    ceebCode: columns.highSchoolCeeb,
    id: columns.email,
  }
}
