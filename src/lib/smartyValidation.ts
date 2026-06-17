import { normalizeZipCode } from './addressClean'

export type SmartyValidationResult = {
  rowIndex: number
  valid: boolean
  configured: boolean
  message: string
  dpvMatchCode?: string
  standardized?: {
    address1: string
    address2: string
    city: string
    state: string
    zip: string
  }
}

export async function validateAddressWithSmarty(row: {
  'Address 1'?: string
  'Address 2'?: string
  City?: string
  State?: string
  'Zip Code'?: string
}): Promise<{
  configured: boolean
  valid: boolean
  message: string
  dpvMatchCode?: string
  standardized?: SmartyValidationResult['standardized']
}> {
  const street = [row['Address 1']?.trim(), row['Address 2']?.trim()].filter(Boolean).join(' ')
  const city = row.City?.trim() ?? ''
  const state = row.State?.trim() ?? ''
  const zip = normalizeZipCode(row['Zip Code']?.trim() ?? '')

  if (!street) {
    return { configured: true, valid: false, message: 'No address to validate.' }
  }

  const params = new URLSearchParams({ street, city, state, zip })
  const response = await fetch(`/api/address/validate?${params.toString()}`)

  if (response.status === 503) {
    const data = (await response.json()) as { configured: boolean; error?: string }
    return {
      configured: false,
      valid: false,
      message: data.error ?? 'Smarty not configured.',
    }
  }

  if (!response.ok) {
    return { configured: true, valid: false, message: 'Validation request failed.' }
  }

  const data = (await response.json()) as {
    configured: boolean
    valid: boolean
    message: string
    dpvMatchCode?: string
    standardized?: SmartyValidationResult['standardized']
  }

  return data
}

export async function validateAddressesBatch(
  rows: Record<string, string>[],
  rowIndexes: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<SmartyValidationResult[]> {
  const results: SmartyValidationResult[] = []
  let done = 0

  for (const rowIndex of rowIndexes) {
    const row = rows[rowIndex]
    const outcome = await validateAddressWithSmarty(row)
    results.push({
      rowIndex,
      valid: outcome.valid,
      configured: outcome.configured,
      message: outcome.message,
      dpvMatchCode: outcome.dpvMatchCode,
      standardized: outcome.standardized,
    })
    done++
    onProgress?.(done, rowIndexes.length)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  return results
}
