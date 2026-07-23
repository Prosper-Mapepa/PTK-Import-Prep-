export type NicheRow = Record<string, string>

export type NicheFieldChange = {
  rowIndex: number
  rowId: string
  name: string
  field: string
  before: string
  after: string
  action: string
}

export type NicheAddressIssue = {
  rowIndex: number
  rowId: string
  name: string
  issues: string[]
}

export type NicheColumnMap = {
  firstName: string | null
  lastName: string | null
  email: string | null
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
  highSchoolName: string | null
  highSchoolCeeb: string | null
  collegeName: string | null
  collegeCeeb: string | null
  prospectiveType: string | null
  transferEnrollmentDate: string | null
  intendedTransferDate: string | null
  majorCip: string | null
  cmuAoi: string | null
}

