export type CampusType = 'main' | 'online'

export type PtkRow = Record<string, string>

export type AddressIssue = {
  rowIndex: number
  ptkId: string
  name: string
  issues: string[]
}

export type AddressCleanChange = {
  rowIndex: number
  ptkId: string
  name: string
  field: string
  before: string
  after: string
  action: string
}

export type CeebChange = {
  rowIndex: number
  ptkId: string
  college: string
  before: string
  after: string
  source: 'lookup' | 'padding' | 'online' | 'unchanged'
}

export type CeebStillMissing = {
  rowIndex: number
  ptkId: string
  college: string
  ipedsId: string
}

export type PrepSession = {
  fileName: string
  campusType: CampusType
  startTerm: string
  headers: string[]
  rows: PtkRow[]
  addressIssues: AddressIssue[]
  ceebChanges: CeebChange[]
  ceebStillMissing: CeebStillMissing[]
  aoiMapped: number
  aoiUnmapped: number
}

export const COL_CURRENT_MAJOR_CODE = 'Current Major Code'
export const COL_CMU_AOI = 'CMU AOI'
export const COL_EXPECTED_GRAD = 'Expected Graduation Date'
export const COL_START_TERM = 'Start Term'
export const COL_CEEB = 'CEEB_CODE'

export const HIGH_SCHOOL_CEEB_URL =
  'https://satsuite.collegeboard.org/k12-educators/tools-resources/k12-school-code-search'
export const COLLEGE_CEEB_URL =
  'https://www.suny.edu/attend/ceeb-codes/search_colleges/'

export const CROSSWALK_PATH = '/reference/2025 MajorCIP to AOI crosswalk.xlsx'
export const CEEB_REFERENCE_PATH = '/reference/CEEB codes frequently missing.xlsx'
