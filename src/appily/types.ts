export type AppilyRow = Record<string, string>

export type FieldChange = {
  rowIndex: number
  rowId: string
  name: string
  field: string
  before: string
  after: string
  action: string
}

export type AddressIssue = {
  rowIndex: number
  rowId: string
  name: string
  issues: string[]
}

export type ColumnMap = {
  firstName: string | null
  lastName: string | null
  middleName: string | null
  email: string | null
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
  hsGradYear: string | null
  predictedStartTerm: string | null
  expectedTransferTerm: string | null
  currentCollege: string | null
  ceebCode: string | null
  id: string | null
}

