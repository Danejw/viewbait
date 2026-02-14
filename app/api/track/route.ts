/**
 * POST /api/track
 * Receives analytics events from the frontend (single or batch).
 * Auth optional (anonymous + authenticated). user_id set server-side only.
 * Rate limited; writes via service client. Admin cannot view from this endpoint.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getOptionalAuth } from '@/lib/server/utils/auth'
import { enforceRateLimit } from '@/lib/server/utils/rate-limit'
import {
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { NextResponse } from 'next/server'
import type { TrackEventPayload, TrackBatchBody } from '@/types/analytics'

const MAX_EVENT_NAME_LENGTH = 128
const MAX_PROPERTIES_KEYS = 10
const MAX_PROPERTIES_SIZE_BYTES = 2048
const MAX_BATCH_SIZE = 20
const EVENT_NAME_BLOCKLIST_PREFIXES = ['admin_', 'internal_']

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'credit_card',
  'creditCard',
  'api_key',
  'apiKey',
  'secret',
  'authorization',
])

function isBlockedEventName(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return EVENT_NAME_BLOCKLIST_PREFIXES.some((p) => normalized.startsWith(p))
}

function sanitizeProperties(
  props: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!props || typeof props !== 'object') return {}
  const out: Record<string, unknown> = {}
  const keys = Object.keys(props).filter(
    (k) => !SENSITIVE_KEYS.has(k.toLowerCase())
  )
  for (let i = 0; i < Math.min(keys.length, MAX_PROPERTIES_KEYS); i++) {
    const k = keys[i]
    const v = props[k]
    if (v !== undefined && v !== null && typeof v !== 'function') {
      try {
        const str = JSON.stringify(v)
        if (Buffer.byteLength(str, 'utf8') <= 1024) out[k] = v
      } catch {
        // skip non-serializable
      }
    }
  }
  const totalSize = Buffer.byteLength(JSON.stringify(out), 'utf8')
  if (totalSize > MAX_PROPERTIES_SIZE_BYTES) return {}
  return out
}

function normalizeEvents(body: unknown): TrackEventPayload[] {
  if (body && typeof body === 'object' && Array.isArray((body as TrackBatchBody).events)) {
    const batch = (body as TrackBatchBody).events
    if (batch.length > MAX_BATCH_SIZE) {
      return batch.slice(0, MAX_BATCH_SIZE)
    }
    return batch
  }
  if (body && typeof body === 'object' && 'event_name' in body) {
    const single = body as TrackEventPayload
    return [single]
  }
  return []
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await getOptionalAuth(supabase)

    const rateLimitRes = enforceRateLimit('track', request, user?.id ?? null)
    if (rateLimitRes) return rateLimitRes

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return validationErrorResponse('Invalid JSON body')
    }

    const events = normalizeEvents(body)
    if (events.length === 0) {
      return validationErrorResponse('Missing event_name or events array')
    }

    const rows: Array<{
      event_name: string
      user_id: string | null
      session_id: string
      page_path: string | null
      properties: Record<string, unknown>
    }> = []

    for (const ev of events) {
      const name =
        typeof ev.event_name === 'string' ? ev.event_name.trim() : ''
      if (!name) continue
      if (name.length > MAX_EVENT_NAME_LENGTH) continue
      if (isBlockedEventName(name)) continue

      const sessionId =
        typeof ev.session_id === 'string' && ev.session_id.trim()
          ? ev.session_id.trim().slice(0, 256)
          : ''
      if (!sessionId) continue

      const pagePath =
        typeof ev.page_path === 'string' ? ev.page_path.slice(0, 2048) : null
      const properties = sanitizeProperties(ev.properties)

      rows.push({
        event_name: name,
        user_id: user?.id ?? null,
        session_id: sessionId,
        page_path: pagePath || null,
        properties,
      })
    }

    if (rows.length === 0) {
      return validationErrorResponse('No valid events after validation')
    }

    const service = createServiceClient()
    const { error } = await service.from('analytics_events').insert(rows)

    if (error) {
      return serverErrorResponse(error, 'Failed to store events', {
        route: 'POST /api/track',
      })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return serverErrorResponse(err, 'Failed to track events', {
      route: 'POST /api/track',
    })
  }
}
