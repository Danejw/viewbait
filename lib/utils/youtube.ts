/**
 * YouTube URL / ID helpers (shared by chat, channel-videos, etc.)
 * Use for parsing video IDs from URLs or raw IDs.
 */

/**
 * Parse a single string (URL or raw video ID) and return the YouTube video ID, or null.
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/v/ID, or raw 11-char ID.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Raw video ID (YouTube IDs are 11 characters, alphanumeric + - _)
  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed
  }

  try {
    let url: URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      url = new URL(trimmed)
    } else {
      url = new URL(`https://${trimmed}`)
    }

    const host = url.hostname.replace(/^www\./, '')
    if (host !== 'youtube.com' && host !== 'youtu.be') return null

    if (host === 'youtu.be') {
      const videoId = url.pathname.slice(1).split('/')[0]
      return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null
    }

    if (url.pathname === '/watch') {
      const videoId = url.searchParams.get('v')
      return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null
    }

    const vMatch = url.pathname.match(/^\/v\/([\w-]{11})/)
    if (vMatch) return vMatch[1]

    return null
  } catch {
    return null
  }
}

/**
 * Parse an array of strings (URLs or raw video IDs) and return an array of unique video IDs.
 * Invalid entries are skipped.
 */
export function parseYouTubeVideoIds(inputs: string[]): string[] {
  const ids = new Set<string>()
  for (const input of inputs) {
    const id = parseYouTubeVideoId(input)
    if (id) ids.add(id)
  }
  return Array.from(ids)
}
