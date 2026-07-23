import type { NicheColumnMap, NicheFieldChange, NicheRow } from '../types'
import { nicheDisplayName, nicheRowId } from './columns'

export function isTransferProspectiveType(value: string): boolean {
  return /transfer/i.test(value.trim())
}

export function splitNicheByProspectiveType(
  rows: NicheRow[],
  columns: NicheColumnMap,
): { freshmen: NicheRow[]; transfers: NicheRow[] } {
  if (!columns.prospectiveType) {
    return { freshmen: rows, transfers: [] }
  }

  const field = columns.prospectiveType
  const freshmen: NicheRow[] = []
  const transfers: NicheRow[] = []

  for (const row of rows) {
    if (isTransferProspectiveType(row[field] ?? '')) transfers.push(row)
    else freshmen.push(row)
  }

  return { freshmen, transfers }
}

/** High school CEEB codes are typically 6 digits. */
export function normalizeHsCeebCode(value: string): string {
  const digits = String(value).replace(/\D/g, '')
  if (!digits || digits.length > 6) return ''
  return digits.padStart(6, '0')
}

/** College CEEB codes are typically 4 digits. */
export function normalizeCollegeCeebCode(value: string): string {
  const digits = String(value).replace(/\D/g, '')
  if (!digits || digits.length > 4) return ''
  return digits.padStart(4, '0')
}

export function normalizeZipLeadingZeros(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/^(\d{1,5})(-\d{4})?$/)
  if (!match) return trimmed
  const base = match[1].padStart(5, '0')
  return match[2] ? `${base}${match[2]}` : base
}

const CMU_COLLEGE =
  /\bcentral\s+michigan\b|\bcmich\b|\bcmu\b|central michigan university/i

export function isCmuCollegeName(collegeName: string): boolean {
  return CMU_COLLEGE.test(collegeName.trim())
}

export function removeNicheCmuStudents(
  rows: NicheRow[],
  columns: NicheColumnMap,
): { rows: NicheRow[]; removed: NicheRow[]; removedCount: number } {
  if (!columns.collegeName) {
    return { rows, removed: [], removedCount: 0 }
  }

  const field = columns.collegeName
  const kept: NicheRow[] = []
  const removed: NicheRow[] = []

  for (const row of rows) {
    if (isCmuCollegeName(row[field] ?? '')) removed.push(row)
    else kept.push(row)
  }

  return { rows: kept, removed, removedCount: removed.length }
}

export function parseFlexibleDate(value: string): Date | null {
  const text = value.trim()
  if (!text) return null

  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})$/)
  if (us) {
    return new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]))
  }

  const iso = text.match(/^((?:19|20)\d{2})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Next Fall start date as Aug 1 of that year (e.g. Fall 2026 → 8/1/2026). */
export function nextFallEnrollmentDate(now = new Date()): string {
  const year = now.getFullYear()
  const month = now.getMonth()
  const fallYear = month < 7 ? year : year + 1
  return `8/1/${fallYear}`
}

/**
 * Update TransferEnrollmentDate when blank, in the past, or more than two years out.
 * Replacement: next upcoming Fall start (8/1/YYYY).
 */
export function applyTransferEnrollmentDateFixes(
  rows: NicheRow[],
  columns: NicheColumnMap,
  now = new Date(),
): { rows: NicheRow[]; changes: NicheFieldChange[]; replacement: string } {
  const field = columns.transferEnrollmentDate
  const replacement = nextFallEnrollmentDate(now)
  if (!field) return { rows, changes: [], replacement }

  const twoYearsOut = new Date(now)
  twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const changes: NicheFieldChange[] = []
  const nextRows = rows.map((row, rowIndex) => {
    const before = (row[field] ?? '').trim()
    if (!before) {
      const nextRow = { ...row, [field]: replacement }
      changes.push({
        rowIndex,
        rowId: nicheRowId(row, columns, rowIndex),
        name: nicheDisplayName(row, columns),
        field,
        before,
        after: replacement,
        action: 'Blank → next Fall start',
      })
      return nextRow
    }

    const parsed = parseFlexibleDate(before)
    if (!parsed) return row

    const day = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
    let reason = ''
    if (day < today) reason = 'Past date → next Fall start'
    else if (day > twoYearsOut) reason = 'More than 2 years out → next Fall start'
    else return row

    if (before === replacement) return row

    const nextRow = { ...row, [field]: replacement }
    changes.push({
      rowIndex,
      rowId: nicheRowId(row, columns, rowIndex),
      name: nicheDisplayName(row, columns),
      field,
      before,
      after: replacement,
      action: reason,
    })
    return nextRow
  })

  return { rows: nextRows, changes, replacement }
}

/**
 * Update IntendedTransferDate when blank or in the past (maps to start term).
 * Replacement: next upcoming Fall start (8/1/YYYY).
 */
export function applyIntendedTransferDateFixes(
  rows: NicheRow[],
  columns: NicheColumnMap,
  now = new Date(),
): { rows: NicheRow[]; changes: NicheFieldChange[]; replacement: string } {
  const field = columns.intendedTransferDate
  const replacement = nextFallEnrollmentDate(now)
  if (!field) return { rows, changes: [], replacement }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const changes: NicheFieldChange[] = []

  const nextRows = rows.map((row, rowIndex) => {
    const before = (row[field] ?? '').trim()
    if (!before) {
      const nextRow = { ...row, [field]: replacement }
      changes.push({
        rowIndex,
        rowId: nicheRowId(row, columns, rowIndex),
        name: nicheDisplayName(row, columns),
        field,
        before,
        after: replacement,
        action: 'Blank → next Fall start',
      })
      return nextRow
    }

    const parsed = parseFlexibleDate(before)
    if (!parsed) return row

    const day = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
    if (day >= today || before === replacement) return row

    const nextRow = { ...row, [field]: replacement }
    changes.push({
      rowIndex,
      rowId: nicheRowId(row, columns, rowIndex),
      name: nicheDisplayName(row, columns),
      field,
      before,
      after: replacement,
      action: 'Past date → next Fall start',
    })
    return nextRow
  })

  return { rows: nextRows, changes, replacement }
}


