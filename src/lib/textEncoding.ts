const FANCY_APOSTROPHE = /[\u2018\u2019\u201B\u2032`]/g
const FANCY_APOSTROPHE_TEST = /[\u2018\u2019\u201B\u2032`]/
const ALLOWED_NAME_CHAR = /[A-Za-z .\-']/

/** True when a name has accents, mojibake, or other non-ASCII characters. */
export function hasNonAsciiNameChars(value: string): boolean {
  if (!value) return false
  if (FANCY_APOSTROPHE_TEST.test(value)) return true
  return [...value].some((char) => !ALLOWED_NAME_CHAR.test(char))
}

/** Strip accents to plain ASCII (e.g. Renée → Renee). */
export function sanitizeNameChars(value: string): string {
  if (!value) return value

  let text = value.replace(FANCY_APOSTROPHE, "'")
  text = tryFixMojibake(text)
  text = text.normalize('NFD').replace(/\p{M}/gu, '')
  return [...text]
    .map((char) => (ALLOWED_NAME_CHAR.test(char) ? char : ''))
    .join('')
}

const MOJIBAKE_MARKERS = /Ã|Â|â€|ï¿½/

function tryFixMojibake(value: string): string {
  if (!value || !MOJIBAKE_MARKERS.test(value)) return value
  if (!/^[\u0000-\u00FF]*$/.test(value)) return value

  const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff)
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  if (!decoded || decoded.includes('\uFFFD')) return value

  return decoded.replace(/\uFFFD/g, '')
}

const EXPLICIT_NAME_FIELDS = new Set([
  'First Name',
  'Last Name',
  'Middle Name',
  'Preferred Name',
  'Legal First Name',
  'Legal Last Name',
])

export function isNameField(header: string): boolean {
  const trimmed = header.trim()
  if (EXPLICIT_NAME_FIELDS.has(trimmed)) return true
  return /^(first|last|middle|preferred|legal)\s+name$/i.test(trimmed)
}
