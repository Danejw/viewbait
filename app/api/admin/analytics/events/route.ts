/**
 * GET /api/admin/analytics/events
 * Event-level analytics (admin only). Returns all events (by usage), active users,
 * errors, and optional journeys. Use view=journeys for session journeys with caps.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/server/utils/roles'
import { serverErrorResponse } from '@/lib/server/utils/error-handler'
import { NextResponse } from 'next/server'
import type {
  AdminEventsAnalyticsResponse,
  AdminEventsJourneysResponse,
} from '@/types/analytics'

const DEFAULT_RANGE_DAYS = 30
const JOURNEY_SESSIONS_LIMIT = 100
const JOURNEY_EVENTS_PER_SESSION = 50
const ALL_EVENTS_CAP = 500
const RECENT_ERRORS_LIMIT = 20
const TOP_PATHS_SAMPLE_LIMIT = 5000
const TOP_PATHS_N = 50
const TIME_SERIES_SAMPLE_LIMIT = 100_000

function getRangeDates(range: string): { from: string; to: string } {
  const days =
    range === '7d' ? 7 : range === '30d' ? 30 : DEFAULT_RANGE_DAYS
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - days)
  from.setUTCHours(0, 0, 0, 0)
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const service = createServiceClient()
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') ?? '30d'
    const view = searchParams.get('view')
    const { from, to } = getRangeDates(range)

    if (view === 'journeys') {
      const sessionsLimit = Math.min(
        parseInt(searchParams.get('sessions_limit') ?? String(JOURNEY_SESSIONS_LIMIT), 10) || JOURNEY_SESSIONS_LIMIT,
        200
      )
      const eventsPerSession =
        Math.min(
          parseInt(searchParams.get('events_per_session') ?? String(JOURNEY_EVENTS_PER_SESSION), 10) || JOURNEY_EVENTS_PER_SESSION,
          100
        )

      const { data: rawEvents, error } = await service
        .from('analytics_events')
        .select('id, session_id, user_id, event_name, created_at, page_path')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: true })

      if (error) {
        return serverErrorResponse(error, 'Failed to load journeys', {
          route: 'GET /api/admin/analytics/events',
        })
      }

      const bySession = new Map<
        string,
        Array<{ event_name: string; created_at: string; page_path: string | null }>
      >()
      for (const row of rawEvents ?? []) {
        const key = row.session_id
        if (!bySession.has(key)) {
          bySession.set(key, [])
        }
        const arr = bySession.get(key)!
        if (arr.length < eventsPerSession) {
          arr.push({
            event_name: row.event_name,
            created_at: row.created_at,
            page_path: row.page_path,
          })
        } else {
          arr.shift()
          arr.push({
            event_name: row.event_name,
            created_at: row.created_at,
            page_path: row.page_path,
          })
        }
      }

      const sessions = Array.from(bySession.entries())
        .slice(-sessionsLimit)
        .map(([session_id, events]) => {
          const first = rawEvents?.find((r) => r.session_id === session_id)
          return {
            session_id,
            user_id: first?.user_id ?? null,
            events: events.slice(-eventsPerSession),
          }
        })

      const body: AdminEventsJourneysResponse = { sessions }
      return NextResponse.json(body)
    }

    const [
      { data: eventRows },
      { data: activeDaily },
      { data: activeWeekly },
      { data: activeMonthly },
      { count: errorTotalInRange },
      { data: errorRows },
      { data: pageViewRows },
    ] = await Promise.all([
      service
        .from('analytics_events')
        .select('event_name')
        .gte('created_at', from)
        .lte('created_at', to),
      service
        .from('analytics_events')
        .select('user_id, session_id')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', to),
      service
        .from('analytics_events')
        .select('user_id, session_id')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', to),
      service
        .from('analytics_events')
        .select('user_id, session_id')
        .gte('created_at', from)
        .lte('created_at', to),
      service
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_name', 'error')
        .gte('created_at', from)
        .lte('created_at', to),
      service
        .from('analytics_events')
        .select('id, created_at, properties')
        .eq('event_name', 'error')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(RECENT_ERRORS_LIMIT),
      service
        .from('analytics_events')
        .select('page_path, properties')
        .eq('event_name', 'page_view')
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(TOP_PATHS_SAMPLE_LIMIT),
    ])

    const eventCounts = new Map<string, number>()
    for (const row of eventRows ?? []) {
      const name = row.event_name ?? 'unknown'
      eventCounts.set(name, (eventCounts.get(name) ?? 0) + 1)
    }
    const allEvents = Array.from(eventCounts.entries())
      .map(([event_name, count]) => ({ event_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, ALL_EVENTS_CAP)

    const distinct = (rows: { user_id: string | null; session_id: string }[]): number => {
      const seen = new Set<string>()
      for (const r of rows) {
        const key = r.user_id ?? `s:${r.session_id}`
        seen.add(key)
      }
      return seen.size
    }

    const generateStarted =
      eventRows?.filter((r) => r.event_name === 'generate_started').length ?? 0
    const generateCompleted =
      eventRows?.filter((r) => r.event_name === 'generate_completed').length ?? 0
    const dropOffRate =
      generateStarted > 0
        ? 1 - generateCompleted / generateStarted
        : 0

    const checkoutStarted =
      eventRows?.filter((r) => r.event_name === 'checkout_started').length ?? 0
    const checkoutCompleted =
      eventRows?.filter((r) => r.event_name === 'checkout_completed').length ?? 0
    const checkoutDropOffRate =
      checkoutStarted > 0
        ? 1 - checkoutCompleted / checkoutStarted
        : 0

    const pathCounts = new Map<string, number>()
    for (const row of pageViewRows ?? []) {
      const r = row as { page_path?: string | null; properties?: { path?: string } }
      const path = r.page_path ?? r.properties?.path ?? '(unknown)'
      pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1)
    }
    const topPaths = Array.from(pathCounts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_PATHS_N)

    const body: AdminEventsAnalyticsResponse = {
      allEvents,
      activeUsers: {
        daily: distinct(activeDaily ?? []),
        weekly: distinct(activeWeekly ?? []),
        monthly: distinct(activeMonthly ?? []),
      },
      errors: {
        totalInRange: errorTotalInRange ?? 0,
        recent: (errorRows ?? []).map((r) => ({
          id: r.id,
          created_at: r.created_at,
          properties: (r.properties as Record<string, unknown>) ?? {},
        })),
      },
      topPaths,
      featureAdoption: {
        generateStarted,
        generateCompleted,
        dropOffRate,
        checkoutStarted,
        checkoutCompleted,
        checkoutDropOffRate,
        assistantMessagesSent:
          eventRows?.filter((r) => r.event_name === 'assistant_message_sent').length ?? 0,
        assistantResponsesReceived:
          eventRows?.filter((r) => r.event_name === 'assistant_response_received').length ?? 0,
        youtubeConnectStarted:
          eventRows?.filter((r) => r.event_name === 'youtube_connect_started').length ?? 0,
        youtubeConnectCompleted:
          eventRows?.filter((r) => r.event_name === 'youtube_connect_completed').length ?? 0,
        youtubeConnectFailed:
          eventRows?.filter((r) => r.event_name === 'youtube_connect_failed').length ?? 0,
      },
    }

    if (searchParams.get('series') === '1') {
      const { data: seriesRows } = await service
        .from('analytics_events')
        .select('event_name, created_at, user_id, session_id')
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(TIME_SERIES_SAMPLE_LIMIT)
      const byDate = new Map<string, {
        events: number
        pageViews: number
        dau: Set<string>
        generateStarted: number
        generateCompleted: number
        errors: number
      }>()
      for (const row of seriesRows ?? []) {
        const d = (row as { created_at: string }).created_at
        const dateStr = d ? d.slice(0, 10) : ''
        if (!dateStr) continue
        if (!byDate.has(dateStr)) {
          byDate.set(dateStr, {
            events: 0,
            pageViews: 0,
            dau: new Set(),
            generateStarted: 0,
            generateCompleted: 0,
            errors: 0,
          })
        }
        const b = byDate.get(dateStr)!
        b.events += 1
        const name = (row as { event_name: string }).event_name ?? ''
        if (name === 'page_view') b.pageViews += 1
        if (name === 'generate_started') b.generateStarted += 1
        if (name === 'generate_completed') b.generateCompleted += 1
        if (name === 'error') b.errors += 1
        const uid = (row as { user_id: string | null }).user_id
        const sid = (row as { session_id: string }).session_id
        b.dau.add(uid ?? `s:${sid}`)
      }
      const timeSeries: AdminEventsTimeSeriesBucket[] = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, b]) => ({
          date,
          events: b.events,
          pageViews: b.pageViews,
          dau: b.dau.size,
          generateStarted: b.generateStarted,
          generateCompleted: b.generateCompleted,
          errors: b.errors,
        }))
      body.timeSeries = timeSeries
    }

    return NextResponse.json(body)
  } catch (err) {
    if (err instanceof Response) return err
    return serverErrorResponse(err, 'Failed to load event analytics', {
      route: 'GET /api/admin/analytics/events',
    })
  }
}
