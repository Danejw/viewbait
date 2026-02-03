/**
 * Palette Public Toggle API Route
 * 
 * Handles toggling public status for a palette.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { notFoundResponse, forbiddenResponse, databaseErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

/**
 * POST /api/palettes/[id]/public
 * Toggle public status for a palette
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

    // Verify user owns the palette
    const { data: current, error: checkError } = await supabase
      .from('palettes')
      .select('is_public, user_id, is_default')
      .eq('id', id)
      .single()

    if (checkError || !current) {
      return notFoundResponse('Palette not found')
    }

    if (current.is_default || current.user_id !== user.id) {
      return forbiddenResponse('Access denied')
    }

    const newStatus = !current.is_public

    // Update public status
    const { data: palette, error: updateError } = await supabase
      .from('palettes')
      .update({ is_public: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'POST /api/palettes/[id]/public',
        userId: user.id,
        operation: 'update-public-status',
        paletteId: id,
      })
      return databaseErrorResponse('Failed to update public status')
    }

    return NextResponse.json({ 
      palette,
      isPublic: newStatus 
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/palettes/[id]/public', 'toggle-palette-public-status', undefined, 'Failed to toggle palette public status')
  }
}

