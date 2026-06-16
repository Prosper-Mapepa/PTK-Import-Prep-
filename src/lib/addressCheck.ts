import type { AddressIssue, PtkRow } from '../types'
import { addressNeedsReview } from './addressClean'

const ADDRESS_FIELDS = ['Address 1', 'Address 2', 'City', 'State', 'Country', 'Zip Code'] as const

export function findAddressIssues(rows: PtkRow[]): AddressIssue[] {
  const issues: AddressIssue[] = []

  rows.forEach((row, rowIndex) => {
    const rowIssues = addressNeedsReview(row)
    if (rowIssues.length > 0) {
      issues.push({
        rowIndex,
        ptkId: row['Phi Theta Kappa ID'] ?? String(rowIndex + 1),
        name: [row['First Name'], row['Last Name']].filter(Boolean).join(' '),
        issues: rowIssues,
      })
    }
  })

  return issues
}

export function getAddressPreview(row: PtkRow): string {
  return ADDRESS_FIELDS.map((field) => row[field]?.trim())
    .filter(Boolean)
    .join(', ')
}
