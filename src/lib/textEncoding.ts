const MOJIBAKE_MARKERS = /Ã|Â|â€|ï¿½|/

export function fixTextEncoding(value: string): string {
  if (!value) return value

  let result = value

  if (MOJIBAKE_MARKERS.test(result) && /^[\u0000-\u00FF]*$/.test(result)) {
    const bytes = Uint8Array.from(result, (char) => char.charCodeAt(0) & 0xff)
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if (decoded && !decoded.includes('\uFFFD')) {
      result = decoded
    }
  }

  result = result
    .replace(/\uFFFD/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return result
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
