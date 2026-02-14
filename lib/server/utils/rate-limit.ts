/**
 * In-memory rate limiter for API routes.
 * Tracks request timestamps per key (e.g. user id); limits requests per time window.
 * Note: In serverless, limits are per instance. For cross-instance limits use Redis/Upstash.
 * Sensitive routes use enforceRateLimit with config in RATE_LIMIT_CONFIG; limits are
 * per-instance until a shared store (e.g. Redis/Upstash) is added.
 */

import { NextResponse } from 'next/server'
import { rateLimitResponse } from '@/lib/server/utils/error-handler'

/** Source of truth for which routes are rate-limited and at what limits (per minute). */
export const RATE_LIMIT_CONFIG = {
  'generate': {
    limitPerWindow: 20,
    message: 'Too many generation requests. Please try again in a minute.',
  },
  'assistant-chat': {
    limitPerWindow: 30,
    message: 'Too many requests. Please try again in a minute.',
  },
  'agent-chat': {
    limitPerWindow: 30,
    message: 'Too many requests. Please try again in a minute.',
  },
  'account-export': {
    limitPerWindow: 5,
    message: 'Too many export requests. Please try again in a minute.',
  },
  'account-delete': {
    limitPerWindow: 5,
    message: 'Too many requests. Please try again in a minute.',
  },
  'join-editor-slug': {
    limitPerWindow: 10,
    message: 'Too many join attempts. Please try again in a minute.',
  },
  'track': {
    limitPerWindow: 120,
    message: 'Too many analytics requests. Please try again in a minute.',
  },
} as const

export type RateLimitRouteId = keyof typeof RATE_LIMIT_CONFIG

/**
 * Build rate-limit key from route and identity. When userId is null (e.g. unauthenticated),
 * uses request IP so future login/unauthenticated routes can reuse this API.
 */
function getRateLimitKey(routeId: RateLimitRouteId, request: Request, userId: string | null): string {
  if (userId) {
    return `${routeId}:${userId}`
  }
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip')?.trim() ?? 'anon'
  return `${routeId}:ip:${ip}`
}

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

/**
 * Single entry point for route-level rate limiting. Use this in API routes instead of
 * calling checkRateLimit and rateLimitResponse directly.
 * @param routeId - Identifier from RATE_LIMIT_CONFIG
 * @param request - Incoming request (used for IP when userId is null)
 * @param userId - Authenticated user id, or null for unauthenticated
 * @returns null if allowed; NextResponse (429) if rate limited
 */
export function enforceRateLimit(
  routeId: RateLimitRouteId,
  request: Request,
  userId: string | null
): NextResponse | null {
  const key = getRateLimitKey(routeId, request, userId)
  const config = RATE_LIMIT_CONFIG[routeId]
  const allowed = checkRateLimit(key, config.limitPerWindow)
  if (allowed) {
    return null
  }
  return rateLimitResponse(config.message)
}
