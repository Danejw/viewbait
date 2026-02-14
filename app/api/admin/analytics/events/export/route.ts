/**
 * GET /api/admin/analytics/events/export
 * Admin-only. Streams analytics_events for the given range as CSV.
 * Query: range=7d|30d (default 30d). Limit 10_000 rows.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/server/utils/roles'
import { NextResponse } from 'next/server'

const DEFAULT_RANGE_DAYS = 30
const EXPORT_LIMIT = 10_000

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

function escapeCsvField(value: unknown): string {
  const s = value == null ? '' : String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') ?? '30d'
    const { from, to } = getRangeDates(range)

    const service = createServiceClient()
    const { data: rows, error } = await service
      .from('analytics_events')
      .select('id, event_name, user_id, session_id, page_path, created_at, properties')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: true })
      .limit(EXPORT_LIMIT)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    const headers = ['id', 'event_name', 'user_id', 'session_id', 'page_path', 'created_at', 'properties']
    const headerLine = headers.join(',') + '\n'
    const bodyLines = (rows ?? []).map((r) => {
      const row = r as {
        id?: string
        event_name?: string
        user_id?: string | null
        session_id?: string
        page_path?: string | null
        created_at?: string
        properties?: unknown
      }
      return [
        escapeCsvField(row.id),
        escapeCsvField(row.event_name),
        escapeCsvField(row.user_id),
        escapeCsvField(row.session_id),
        escapeCsvField(row.page_path),
        escapeCsvField(row.created_at),
        escapeCsvField(row.properties != null ? JSON.stringify(row.properties) : ''),
      ].join(',') + '\n'
    })
    const csv = headerLine + bodyLines.join('')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="analytics-events-${range}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    )
  }
}
