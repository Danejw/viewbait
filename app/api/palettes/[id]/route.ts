/**
 * Palette by ID API Route
 * 
 * Handles GET, PATCH, and DELETE operations for a specific palette.
 * All operations verify user ownership for security (except for public palettes).
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { PaletteUpdate } from '@/lib/types/database'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { isUUID } from '@/lib/server/utils/uuid-validation'
import { notFoundResponse, validationErrorResponse, forbiddenResponse, databaseErrorResponse, serverErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

/**
 * GET /api/palettes/[id]
 * Get a single palette by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string | undefined
  
  try {
    const supabase = await createClient()
    const { id } = await params
    const user = await requireAuth(supabase)
    userId = user.id

    // Validate user.id is a valid UUID (should always be, but validate for safety)
    if (!isUUID(user.id)) {
      logError(new Error('Invalid user ID format'), {
        route: 'GET /api/palettes/[id]',
        userId: user.id,
        operation: 'validate-user-id',
      })
      return serverErrorResponse(new Error('Invalid user ID'), 'Failed to get palette', {
        route: 'GET /api/palettes/[id]',
        userId: user.id,
      })
    }

    // Get palette (user's own, default, or public)
    // Use safe query construction - validate user.id first, then use parameterized query
    const { data: palette, error } = await supabase
      .from('palettes')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${user.id},is_default.eq.true,is_public.eq.true`)
      .single()

    if (error || !palette) {
      return notFoundResponse('Palette not found')
    }

    return NextResponse.json({ palette })
  } catch (error) {
    return handleApiError(error, 'GET /api/palettes/[id]', 'get-palette', undefined, 'Failed to get palette')
  }
}

/**
 * PATCH /api/palettes/[id]
 * Update a palette
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string | undefined
  
  try {
    const supabase = await createClient()
    const { id } = await params
    const user = await requireAuth(supabase)
    userId = user.id

    // Verify user owns the palette (cannot update defaults or others' palettes)
    const { data: existing, error: checkError } = await supabase
      .from('palettes')
      .select('id, user_id, is_default')
      .eq('id', id)
      .single()

    if (checkError || !existing) {
      return notFoundResponse('Palette not found')
    }

    if (existing.is_default || existing.user_id !== user.id) {
      return forbiddenResponse('Access denied')
    }

    // Parse request body
    const body: PaletteUpdate = await request.json()
    
    // Validate name if provided
    if (body.name !== undefined && (!body.name || !body.name.trim())) {
      return validationErrorResponse('Name cannot be empty')
    }

    // Validate colors if provided
    if (body.colors !== undefined && (!Array.isArray(body.colors) || body.colors.length === 0)) {
      return validationErrorResponse('Colors array cannot be empty')
    }

    // Update palette (prevent changing is_default)
    const updateData: PaletteUpdate = {
      ...body,
      updated_at: new Date().toISOString(),
    }
    // Prevent changing is_default
    const { is_default: _, ...safeUpdateData } = updateData as PaletteUpdate & { is_default?: boolean }

    const { data: palette, error: updateError } = await supabase
      .from('palettes')
      .update(safeUpdateData as PaletteUpdate)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'PATCH /api/palettes/[id]',
        userId: user.id,
        operation: 'update-palette',
        paletteId: id,
      })
      return databaseErrorResponse('Failed to update palette')
    }

    return NextResponse.json({ palette })
  } catch (error) {
    return handleApiError(error, 'PATCH /api/palettes/[id]', 'update-palette', undefined, 'Failed to update palette')
  }
}

/**
 * DELETE /api/palettes/[id]
 * Delete a palette
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string | undefined
  
  try {
    const supabase = await createClient()
    const { id } = await params
    const user = await requireAuth(supabase)
    userId = user.id

    // Verify user owns the palette (cannot delete defaults)
    const { data: existing } = await supabase
      .from('palettes')
      .select('id, user_id, is_default')
      .eq('id', id)
      .single()

    if (!existing) {
      return notFoundResponse('Palette not found')
    }

    if (existing.is_default || existing.user_id !== user.id) {
      return forbiddenResponse('Access denied')
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('palettes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (dbError) {
      logError(dbError, {
        route: 'DELETE /api/palettes/[id]',
        userId: user.id,
        operation: 'delete-palette',
        paletteId: id,
      })
      return databaseErrorResponse('Failed to delete palette')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'DELETE /api/palettes/[id]', 'delete-palette', undefined, 'Failed to delete palette')
  }
}

