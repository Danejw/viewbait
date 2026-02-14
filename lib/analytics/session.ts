/**
 * Session ID for analytics. Stored in localStorage; reused for all events
 * in the same browser context. Key chosen to avoid collisions.
 */

const STORAGE_KEY = 'vb_sid'

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let sid = localStorage.getItem(STORAGE_KEY)
    if (!sid || sid.length < 10) {
      sid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
      localStorage.setItem(STORAGE_KEY, sid)
    }
    return sid
  } catch {
    return `anon_${Date.now()}`
  }
}
