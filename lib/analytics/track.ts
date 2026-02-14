/**
 * Client-side analytics tracking. Non-blocking; queues and flushes to POST /api/track.
 * Session ID from localStorage; optional user_id can be set by app when authenticated.
 */

import { getOrCreateSessionId } from '@/lib/analytics/session'

const QUEUE_MAX_SIZE = 10
const FLUSH_INTERVAL_MS = 5000
const BATCH_API = '/api/track'

type QueuedEvent = {
  event_name: string
  session_id: string
  page_path: string
  properties: Record<string, unknown>
}

let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let userId: string | null = null

/**
 * Set the current user id for subsequent track() calls (e.g. after auth).
 * Call with null when user logs out.
 */
export function setTrackUserId(id: string | null): void {
  userId = id
}

function getPagePath(): string {
  if (typeof window === 'undefined') return ''
  return window.location.pathname + window.location.search
}

function flush(): void {
  if (queue.length === 0) return
  const toSend = queue.splice(0, queue.length)
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  const payload = {
    events: toSend.map((e) => ({
      event_name: e.event_name,
      session_id: e.session_id,
      page_path: e.page_path,
      properties: e.properties,
    })),
  }

  const schedule =
    typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 0)

  schedule(() => {
    fetch(BATCH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  })
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, FLUSH_INTERVAL_MS)
}

/**
 * Track an event. Non-blocking; enqueues and flushes in batches.
 * Do not pass sensitive data in properties (passwords, tokens, etc.).
 */
export function track(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return
  const sessionId = getOrCreateSessionId()
  if (!sessionId) return

  const safeProperties =
    properties && typeof properties === 'object'
      ? { ...properties }
      : {}

  const event: QueuedEvent = {
    event_name: eventName,
    session_id: sessionId,
    page_path: getPagePath(),
    properties: safeProperties,
  }

  queue.push(event)

  if (queue.length >= QUEUE_MAX_SIZE) {
    flush()
  } else {
    scheduleFlush()
  }
}

/**
 * For single critical events, call this to send immediately without waiting for batch.
 * Still non-blocking (fire-and-forget).
 */
export function trackImmediate(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return
  const sessionId = getOrCreateSessionId()
  if (!sessionId) return

  const payload = {
    event_name: eventName,
    session_id: sessionId,
    page_path: getPagePath(),
    properties: properties && typeof properties === 'object' ? properties : {},
  }

  const schedule =
    typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 0)

  schedule(() => {
    fetch(BATCH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  })
}
