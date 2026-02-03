/**
 * Style Public Toggle API Route
 * 
 * Handles toggling public status for a style.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { notFoundResponse, forbiddenResponse, databaseErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

/**
 * POST /api/styles/[id]/public
 * Toggle public status for a style
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

    // Verify user owns the style
    const { data: current, error: checkError } = await supabase
      .from('styles')
      .select('is_public, user_id, is_default')
      .eq('id', id)
      .single()

    if (checkError || !current) {
      return notFoundResponse('Style not found')
    }

    if (current.is_default || current.user_id !== user.id) {
      return forbiddenResponse('Access denied')
    }

    const newStatus = !current.is_public

    // Update public status
    const { data: style, error: updateError } = await supabase
      .from('styles')
      .update({ is_public: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'POST /api/styles/[id]/public',
        userId: user.id,
        operation: 'update-public-status',
        styleId: id,
      })
      return databaseErrorResponse('Failed to update public status')
    }

    return NextResponse.json({ 
      style,
      isPublic: newStatus 
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/styles/[id]/public', 'toggle-style-public-status', undefined, 'Failed to toggle style public status')
  }
}

