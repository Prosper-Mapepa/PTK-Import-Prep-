const onlineCache = new Map<string, string | null>()

export async function searchCollegeCeebOnline(college: string): Promise<string | null> {
  const key = college.trim().toLowerCase()
  if (!key) return null
  if (onlineCache.has(key)) return onlineCache.get(key) ?? null

  const response = await fetch(`/api/ceeb/search?college=${encodeURIComponent(college)}`)
  if (!response.ok) {
    onlineCache.set(key, null)
    return null
  }

  const data = (await response.json()) as { code?: string | null }
  const code = data.code?.trim() || null
  onlineCache.set(key, code)
  return code
}

export function clearOnlineCeebCache() {
  onlineCache.clear()
}
