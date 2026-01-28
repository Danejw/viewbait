/**
 * Thumbnail Favorite API Route
 * 
 * Handles toggling favorite status for a thumbnail.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sanitizeErrorForClient } from '@/lib/utils/error-sanitizer'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'

/**
 * POST /api/thumbnails/[id]/favorite
 * Toggle favorite status for a thumbnail
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Verify user owns the thumbnail
    const { data: current, error: checkError } = await supabase
      .from('thumbnails')
      .select('liked')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !current) {
      return NextResponse.json(
        { error: 'Thumbnail not found or access denied', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    const newStatus = !current.liked

    // Update favorite status
    const { data: thumbnail, error: updateError } = await supabase
      .from('thumbnails')
      .update({ liked: newStatus })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'POST /api/thumbnails/[id]/favorite',
        userId: user.id,
        operation: 'update-favorite-status',
        thumbnailId: id,
      })
      return NextResponse.json(
        { error: 'Failed to update favorite status', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      thumbnail,
      liked: newStatus 
    })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    logError(error, {
      route: 'POST /api/thumbnails/[id]/favorite',
      operation: 'toggle-thumbnail-favorite',
    })
    return NextResponse.json(
      { 
        error: sanitizeErrorForClient(error, 'toggle-thumbnail-favorite', 'Internal server error'),
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

