/**
 * Face by ID API Route
 * 
 * Handles GET, PATCH, and DELETE operations for a specific face.
 * All operations verify user ownership for security.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshFaceUrls } from '@/lib/server/utils/url-refresh'
import {
  notFoundResponse,
  validationErrorResponse,
  databaseErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { FaceUpdate } from '@/lib/types/database'

/**
 * GET /api/faces/[id]
 * Get a single face by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Get face
    const { data: face, error } = await supabase
      .from('faces')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns the face
      .single()

    if (error || !face) {
      return notFoundResponse('Face not found')
    }

    // Refresh signed URLs
    const [refreshedFace] = await refreshFaceUrls(supabase, [face], user.id)

    return NextResponse.json(refreshedFace)
  } catch (error) {
    return handleApiError(error, 'GET /api/faces/[id]', 'get-face', undefined, 'Failed to fetch face')
  }
}

/**
 * PATCH /api/faces/[id]
 * Update a face
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Verify user owns the face
    const { data: existing, error: checkError } = await supabase
      .from('faces')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !existing) {
      return notFoundResponse('Face not found or access denied')
    }

    // Parse request body
    const body: FaceUpdate = await request.json()
    
    // Validate name if provided
    if (body.name !== undefined && (!body.name || !body.name.trim())) {
      return validationErrorResponse('Name cannot be empty')
    }

    // Update face
    const { data: face, error: updateError } = await supabase
      .from('faces')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'PATCH /api/faces/[id]',
        userId: user.id,
        operation: 'update-face',
        faceId: id,
      })
      return databaseErrorResponse('Failed to update face')
    }

    return NextResponse.json({ face })
  } catch (error) {
    return handleApiError(error, 'PATCH /api/faces/[id]', 'update-face', undefined, 'Failed to update face')
  }
}

/**
 * DELETE /api/faces/[id]
 * Delete a face and its storage files
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Verify user owns the face
    const { data: face } = await supabase
      .from('faces')
      .select('image_urls')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!face) {
      return notFoundResponse('Face not found or access denied')
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('faces')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (dbError) {
      logError(dbError, {
        route: 'DELETE /api/faces/[id]',
        userId: user.id,
        operation: 'delete-face',
        faceId: id,
      })
      return databaseErrorResponse('Failed to delete face')
    }

    // Delete storage files
    const folderPath = `${user.id}/${id}`
    const { data: files } = await supabase.storage
      .from('faces')
      .list(folderPath)

    if (files && files.length > 0) {
      const pathsToDelete = files
        .filter((file) => file.name !== '.emptyFolderPlaceholder')
        .map((file) => `${folderPath}/${file.name}`)
      
      if (pathsToDelete.length > 0) {
        await supabase.storage
          .from('faces')
          .remove(pathsToDelete)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'DELETE /api/faces/[id]', 'delete-face', undefined, 'Failed to delete face')
  }
}

