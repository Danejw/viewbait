/**
 * Thumbnail Public Toggle API Route
 * 
 * Handles toggling public status for a thumbnail.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { notFoundResponse, databaseErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

/**
 * POST /api/thumbnails/[id]/public
 * Toggle public status for a thumbnail
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string | undefined
  
  try {
    const supabase = await createClient()
    const { id } = await params
    const user = await requireAuth(supabase)
    userId = user.id

    // Verify user owns the thumbnail
    const { data: current, error: checkError } = await supabase
      .from('thumbnails')
      .select('is_public, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !current) {
      return notFoundResponse('Thumbnail not found or access denied')
    }

    const newStatus = !current.is_public

    // Update public status
    const { data: thumbnail, error: updateError } = await supabase
      .from('thumbnails')
      .update({ is_public: newStatus })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'POST /api/thumbnails/[id]/public',
        userId: user.id,
        operation: 'update-public-status',
        thumbnailId: id,
      })
      return databaseErrorResponse('Failed to update public status')
    }

    return NextResponse.json({ 
      thumbnail,
      isPublic: newStatus 
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/thumbnails/[id]/public', 'toggle-thumbnail-public-status', undefined, 'Failed to toggle thumbnail public status')
  }
}
