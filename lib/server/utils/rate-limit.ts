/**
 * In-memory rate limiter for API routes.
 * Tracks request timestamps per key (e.g. user id); limits requests per time window.
 * Note: In serverless, limits are per instance. For cross-instance limits use Redis/Upstash.
 */

const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_KEYS = 2000
const PRUNE_AFTER = 100 // Prune when a key has more than this many timestamps

interface Entry {
  timestamps: number[]
}

const store = new Map<string, Entry>()

function pruneOld(key: string, now: number): void {
  const entry = store.get(key)
  if (!entry) return
  const cutoff = now - WINDOW_MS
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
  if (entry.timestamps.length === 0) {
    store.delete(key)
  }
}

function pruneStoreSize(): void {
  if (store.size <= MAX_KEYS) return
  const keys = Array.from(store.keys())
  const toDelete = keys.length - Math.floor(MAX_KEYS * 0.8)
  for (let i = 0; i < toDelete && i < keys.length; i++) {
    store.delete(keys[i])
  }
}

/**
 * Check and consume one request for the given key.
 * @param key - Identifier (e.g. user id or IP)
 * @param limitPerWindow - Max requests allowed in the window (default 10 per minute)
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  limitPerWindow: number = 10
): boolean {
  const now = Date.now()
  pruneOld(key, now)

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  if (entry.timestamps.length >= limitPerWindow) {
    return false
  }

  entry.timestamps.push(now)
  if (entry.timestamps.length > PRUNE_AFTER) {
    entry.timestamps = entry.timestamps.slice(-limitPerWindow)
  }
  pruneStoreSize()
  return true
}
