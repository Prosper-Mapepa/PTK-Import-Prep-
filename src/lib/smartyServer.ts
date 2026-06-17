import { normalizeZipCode } from './addressClean'

type SmartyCandidate = {
  delivery_line_1?: string
  delivery_line_2?: string
  components?: {
    primary_number?: string
    city_name?: string
    state_abbreviation?: string
    zipcode?: string
    plus4_code?: string
  }
  analysis?: {
    dpv_match_code?: string
  }
}

export async function validateWithSmarty(
  params: {
    street: string
    city: string
    state: string
    zip: string
  },
  authId: string,
  authToken: string,
): Promise<{
  valid: boolean
  standardized?: {
    address1: string
    address2: string
    city: string
    state: string
    zip: string
  }
  dpvMatchCode?: string
  message: string
}> {
  const query = new URLSearchParams({
    'auth-id': authId,
    'auth-token': authToken,
    street: params.street,
    city: params.city,
    state: params.state,
    zipcode: normalizeZipCode(params.zip),
    candidates: '1',
    match: 'enhanced',
  })

  const response = await fetch(
    `https://us-street.api.smarty.com/street-address?${query.toString()}`,
  )

  if (!response.ok) {
    if (response.status === 401 || response.status === 402) {
      return { valid: false, message: 'Smarty credentials rejected. Check auth ID and token.' }
    }
    return { valid: false, message: `Smarty request failed (${response.status}).` }
  }

  const results = (await response.json()) as SmartyCandidate[]
  if (!results.length) {
    return { valid: false, message: 'Address not found in USPS data.' }
  }

  const match = results[0]
  const dpv = match.analysis?.dpv_match_code ?? ''
  const hasCandidate = Boolean(
    match.delivery_line_1?.trim() && match.components?.zipcode && match.components?.primary_number,
  )
  const dpvConfirmed = ['Y', 'S', 'D'].includes(dpv)
  const valid = dpvConfirmed || hasCandidate
  const zip = match.components?.zipcode ?? params.zip
  const plus4 = match.components?.plus4_code
  const zipFormatted = plus4 ? `${zip}-${plus4}` : zip

  return {
    valid,
    dpvMatchCode: dpv,
    standardized: valid
      ? {
          address1: match.delivery_line_1 ?? params.street,
          address2: match.delivery_line_2 ?? '',
          city: match.components?.city_name ?? params.city,
          state: match.components?.state_abbreviation ?? params.state,
          zip: zipFormatted,
        }
      : undefined,
    message: valid
      ? dpvConfirmed
        ? 'Verified by Smarty (USPS).'
        : 'Standardized by Smarty.'
      : 'Address not found in USPS data.',
  }
}
