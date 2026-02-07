/**
 * Thumbnail Live Periods API Route
 *
 * GET /api/thumbnails/[id]/live-periods
 * Returns list of live periods for this thumbnail (user must own the thumbnail).
 * Used by thumbnail detail or "Performance" section.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { notFoundResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id: thumbnailId } = await params

    const { data: thumbnail, error: thumbError } = await supabase
      .from('thumbnails')
      .select('id')
      .eq('id', thumbnailId)
      .eq('user_id', user.id)
      .single()

    if (thumbError || !thumbnail) {
      return notFoundResponse('Thumbnail not found')
    }

    const { data: periods, error } = await supabase
      .from('thumbnail_live_periods')
      .select('*')
      .eq('thumbnail_id', thumbnailId)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load live periods' },
        { status: 500 }
      )
    }

    return NextResponse.json({ periods: periods ?? [] })
  } catch (error) {
    return handleApiError(
      error,
      'GET /api/thumbnails/[id]/live-periods',
      'get-thumbnail-live-periods',
      undefined,
      'Failed to get live periods'
    )
  }
}
