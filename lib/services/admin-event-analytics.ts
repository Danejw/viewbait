/**
 * Service for admin event analytics API. Used by Analytics tab (admin only).
 */

import type {
  AdminEventsAnalyticsResponse,
  AdminEventsJourneysResponse,
} from '@/types/analytics'

const EVENTS_API = '/api/admin/analytics/events'

export type EventsRange = '7d' | '30d'

export async function getAdminEventsAnalytics(
  range: EventsRange = '30d',
  includeSeries = false
): Promise<AdminEventsAnalyticsResponse> {
  const params = new URLSearchParams({ range })
  if (includeSeries) params.set('series', '1')
  const res = await fetch(`${EVENTS_API}?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to load event analytics')
  }
  return res.json()
}

export async function getAdminEventsJourneys(
  range: EventsRange = '30d',
  sessionsLimit = 100,
  eventsPerSession = 50
): Promise<AdminEventsJourneysResponse> {
  const params = new URLSearchParams({
    range,
    view: 'journeys',
    sessions_limit: String(sessionsLimit),
    events_per_session: String(eventsPerSession),
  })
  const res = await fetch(`${EVENTS_API}?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to load journeys')
  }
  return res.json()
}
