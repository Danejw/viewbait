/**
 * Extracts unique URLs from arbitrary text in encounter order.
 */
export function extractUrlsFromText(text?: string | null): string[] {
  if (!text) return []

  const urlRegex = /https?:\/\/[^\s)\]}>,]+/gi
  const matches = text.match(urlRegex) ?? []
  const seen = new Set<string>()
  const urls: string[] = []

  for (const raw of matches) {
    const normalized = raw.replace(/[.,!?;:]+$/g, '')
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    urls.push(normalized)
  }

  return urls
}
