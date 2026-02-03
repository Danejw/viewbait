/**
 * Style by ID API Route
 * 
 * Handles GET, PATCH, and DELETE operations for a specific style.
 * All operations verify user ownership for security (except for public styles).
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { StyleUpdate } from '@/lib/types/database'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { isUUID } from '@/lib/server/utils/uuid-validation'
import { notFoundResponse, validationErrorResponse, forbiddenResponse, databaseErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS } from '@/lib/server/utils/url-refresh'

/**
 * GET /api/styles/[id]
 * Get a single style by ID
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
        route: 'GET /api/styles/[id]',
        userId: user.id,
        operation: 'validate-user-id',
      })
      return serverErrorResponse(new Error('Invalid user ID'), 'Failed to get style', {
        route: 'GET /api/styles/[id]',
        userId: user.id,
      })
    }

    // Get style (user's own, default, or public)
    // Use safe query construction - validate user.id first, then use parameterized query
    const { data: style, error } = await supabase
      .from('styles')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${user.id},is_default.eq.true,is_public.eq.true`)
      .single()

    if (error || !style) {
      return notFoundResponse('Style not found')
    }

    // Refresh signed URLs for reference images
    if (style.reference_images && style.reference_images.length > 0) {
      const refreshedUrls = await Promise.all(
        style.reference_images.map(async (url: string) => {
          const signedUrlMatch = url.match(/\/storage\/v1\/object\/sign\/style-references\/([^?]+)/)
          if (signedUrlMatch) {
            const storagePath = signedUrlMatch[1]
            const { data: urlData } = await supabase.storage
              .from('style-references')
              .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS)
            return urlData?.signedUrl || url
          }
          return url
        })
      )

      return NextResponse.json({
        ...style,
        reference_images: refreshedUrls.filter((url): url is string => url !== null && url !== undefined),
      })
    }

    return NextResponse.json({ style })
  } catch (error) {
    return handleApiError(error, 'GET /api/styles/[id]', 'get-style', userId, 'Failed to get style')
  }
}

/**
 * PATCH /api/styles/[id]
 * Update a style
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

    // Verify user owns the style (cannot update defaults or others' styles)
    const { data: existing, error: checkError } = await supabase
      .from('styles')
      .select('id, user_id, is_default')
      .eq('id', id)
      .single()

    if (checkError || !existing) {
      return notFoundResponse('Style not found')
    }

    if (existing.is_default || existing.user_id !== user.id) {
      return forbiddenResponse('Access denied')
    }

    // Parse request body
    const body: StyleUpdate = await request.json()
    
    // Validate name if provided
    if (body.name !== undefined && (!body.name || !body.name.trim())) {
      return validationErrorResponse('Name cannot be empty')
    }

    // Update style (prevent changing is_default)
    const updateData: StyleUpdate = {
      ...body,
      updated_at: new Date().toISOString(),
    }
    // Prevent changing is_default
    const { is_default: _, ...safeUpdateData } = updateData as StyleUpdate & { is_default?: boolean }

    const { data: style, error: updateError } = await supabase
      .from('styles')
      .update(safeUpdateData as StyleUpdate)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'PATCH /api/styles/[id]',
        userId: user.id,
        operation: 'update-style',
        styleId: id,
      })
      return databaseErrorResponse('Failed to update style')
    }

    return NextResponse.json({ style })
  } catch (error) {
    return handleApiError(error, 'PATCH /api/styles/[id]', 'update-style', userId, 'Failed to update style')
  }
}

/**
 * DELETE /api/styles/[id]
 * Delete a style and its associated storage files
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

    // Verify user owns the style (cannot delete defaults)
    const { data: existing } = await supabase
      .from('styles')
      .select('id, user_id, is_default')
      .eq('id', id)
      .single()

    if (!existing) {
      return notFoundResponse('Style not found')
    }

    if (existing.is_default || existing.user_id !== user.id) {
      return forbiddenResponse('Access denied')
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('styles')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (dbError) {
      logError(dbError, {
        route: 'DELETE /api/styles/[id]',
        userId: user.id,
        operation: 'delete-style',
        styleId: id,
      })
      return databaseErrorResponse('Failed to delete style')
    }

    // Delete storage files (references and preview)
    const folderPath = `${user.id}/${id}`
    
    // Delete reference images folder
    const { data: refFiles } = await supabase.storage
      .from('style-references')
      .list(folderPath)
    
    if (refFiles && refFiles.length > 0) {
      const pathsToDelete = refFiles
        .filter((file) => file.name !== '.emptyFolderPlaceholder')
        .map((file) => `${folderPath}/${file.name}`)
      
      if (pathsToDelete.length > 0) {
        await supabase.storage
          .from('style-references')
          .remove(pathsToDelete)
      }
    }

    // Delete preview image
    await supabase.storage
      .from('style-previews')
      .remove([`${folderPath}/preview.png`])

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'DELETE /api/styles/[id]', 'delete-style', userId, 'Failed to delete style')
  }
}

