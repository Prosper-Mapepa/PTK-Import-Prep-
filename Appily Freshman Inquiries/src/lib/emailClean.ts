import type { AppilyRow, ColumnMap, FieldChange } from '../types'
import { displayName, rowId } from './columns'

const DOMAIN_TYPOS: Record<string, string> = {
  'gmail.con': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.coom': 'gmail.com',
  'gmail.cpm': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'yahoo.con': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'ymail.con': 'ymail.com',
  'hotmail.con': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'outlook.con': 'outlook.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'icloud.con': 'icloud.com',
  'live.con': 'live.com',
  'aol.con': 'aol.com',
  'msn.con': 'msn.com',
  'comcast.con': 'comcast.net',
  'att.con': 'att.net',
}

const TLD_TYPOS = [
  [/\.con$/i, '.com'],
  [/\.cmo$/i, '.com'],
  [/\.comm$/i, '.com'],
  [/\.coom$/i, '.com'],
  [/\.cpm$/i, '.com'],
  [/\.vom$/i, '.com'],
] as const

function fixEmailDomain(domain: string): string {
  const lower = domain.toLowerCase().trim()
  if (!lower) return lower
  if (DOMAIN_TYPOS[lower]) return DOMAIN_TYPOS[lower]

  let fixed = lower
  for (const [pattern, replacement] of TLD_TYPOS) {
    fixed = fixed.replace(pattern, replacement)
  }
  return fixed
}

export function fixEmailTypo(email: string): string {
  const trimmed = email.trim()
  const at = trimmed.lastIndexOf('@')
  if (at <= 0 || at === trimmed.length - 1) return trimmed

  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  const fixedDomain = fixEmailDomain(domain)
  if (fixedDomain === domain.toLowerCase()) return trimmed

  return `${local}@${fixedDomain}`
}

export function cleanEmails(
  rows: AppilyRow[],
  columns: ColumnMap,
): { rows: AppilyRow[]; changes: FieldChange[] } {
  if (!columns.email) return { rows, changes: [] }

  const field = columns.email
  const changes: FieldChange[] = []
  const nextRows = rows.map((row, rowIndex) => {
    const before = row[field] ?? ''
    const after = fixEmailTypo(before)
    if (before === after) return row

    const nextRow = { ...row, [field]: after }
    changes.push({
      rowIndex,
      rowId: rowId(row, columns, rowIndex),
      name: displayName(row, columns),
      field,
      before,
      after,
      action: 'Email typo fixed',
    })
    return nextRow
  })

  return { rows: nextRows, changes }
}
