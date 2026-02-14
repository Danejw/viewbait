/**
 * Batch Thumbnail Live Periods API Route
 *
 * GET /api/thumbnails/live-periods?ids=id1,id2,...
 * Returns live periods for multiple thumbnails in one response.
 * Only returns data for thumbnails owned by the authenticated user.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { NextResponse } from 'next/server'
import type { ThumbnailLivePeriod } from '@/lib/types/database'

const MAX_IDS = 20

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    if (!idsParam || idsParam.trim() === '') {
      return NextResponse.json(
        { error: 'Missing ids query parameter' },
        { status: 400 }
      )
    }

    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAX_IDS)

    if (ids.length === 0) {
      return NextResponse.json({ periodsByThumbnailId: {} })
    }

    const { data: thumbnails, error: thumbError } = await supabase
      .from('thumbnails')
      .select('id')
      .in('id', ids)
      .eq('user_id', user.id)

    if (thumbError) {
      return NextResponse.json(
        { error: 'Failed to verify thumbnails' },
        { status: 500 }
      )
    }

    const allowedIds = new Set((thumbnails ?? []).map((t) => t.id))
    if (allowedIds.size === 0) {
      return NextResponse.json({ periodsByThumbnailId: {} })
    }

    const { data: periods, error } = await supabase
      .from('thumbnail_live_periods')
      .select('*')
      .in('thumbnail_id', Array.from(allowedIds))
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load live periods' },
        { status: 500 }
      )
    }

    const periodsByThumbnailId: Record<string, ThumbnailLivePeriod[]> = {}
    for (const id of allowedIds) {
      periodsByThumbnailId[id] = []
    }
    for (const p of periods ?? []) {
      const tid = (p as ThumbnailLivePeriod).thumbnail_id
      if (periodsByThumbnailId[tid]) {
        periodsByThumbnailId[tid].push(p as ThumbnailLivePeriod)
      }
    }

    return NextResponse.json({ periodsByThumbnailId })
  } catch (error) {
    return handleApiError(
      error,
      'GET /api/thumbnails/live-periods',
      'get-thumbnail-live-periods-batch',
      undefined,
      'Failed to get live periods'
    )
  }
}
