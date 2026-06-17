const onlineCache = new Map<string, { code: string | null; source: string | null }>()

export async function searchCollegeCeebOnline(college: string): Promise<{
  code: string | null
  source: 'college-board' | 'excel' | 'supplement' | null
}> {
  const key = college.trim().toLowerCase()
  if (!key) return { code: null, source: null }
  if (onlineCache.has(key)) {
    const cached = onlineCache.get(key)!
    return {
      code: cached.code,
      source: cached.source as 'college-board' | 'excel' | 'supplement' | null,
    }
  }

  const response = await fetch(`/api/ceeb/search?college=${encodeURIComponent(college)}`)
  if (!response.ok) {
    onlineCache.set(key, { code: null, source: null })
    return { code: null, source: null }
  }

  const data = (await response.json()) as {
    code?: string | null
    source?: 'college-board' | 'excel' | 'supplement' | null
  }
  const code = data.code?.trim() || null
  const source = data.source ?? null
  onlineCache.set(key, { code, source })
  return { code, source }
}

export function clearOnlineCeebCache() {
  onlineCache.clear()
}
