/**
 * Thumbnail by ID API Route
 * 
 * Handles GET, PATCH, and DELETE operations for a specific thumbnail.
 * All operations verify user ownership for security.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ThumbnailUpdate } from '@/lib/types/database'
import { getProjectById } from '@/lib/server/data/projects'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { notFoundResponse, validationErrorResponse, databaseErrorResponse, serverErrorResponse } from '@/lib/server/utils/error-handler'

/**
 * GET /api/thumbnails/[id]
 * Get a single thumbnail by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Get thumbnail
    const { data: thumbnail, error } = await supabase
      .from('thumbnails')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns the thumbnail
      .single()

    if (error || !thumbnail) {
      return notFoundResponse('Thumbnail not found')
    }

    // Refresh signed URL
    let storagePath: string | null = null
    
    if (thumbnail.image_url) {
      const signedUrlMatch = thumbnail.image_url.match(/\/storage\/v1\/object\/sign\/thumbnails\/([^?]+)/)
      if (signedUrlMatch) {
        storagePath = signedUrlMatch[1]
      }
    }
    
    if (!storagePath) {
      storagePath = `${user.id}/${thumbnail.id}/thumbnail.png`
    }

    const { data: signedUrlData } = await supabase.storage
      .from('thumbnails')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 year
    
    const newUrl = signedUrlData?.signedUrl || null
    
    if (!newUrl && storagePath.endsWith('.png')) {
      const jpgPath = storagePath.replace('.png', '.jpg')
      const { data: jpgUrlData } = await supabase.storage
        .from('thumbnails')
        .createSignedUrl(jpgPath, 60 * 60 * 24 * 365)
      if (jpgUrlData?.signedUrl) {
        return NextResponse.json({ ...thumbnail, image_url: jpgUrlData.signedUrl })
      }
    }

    return NextResponse.json({
      ...thumbnail,
      image_url: newUrl || thumbnail.image_url,
    })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to get thumbnail', {
      route: 'GET /api/thumbnails/[id]',
    })
  }
}

/**
 * PATCH /api/thumbnails/[id]
 * Update a thumbnail
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Verify user owns the thumbnail
    const { data: existing, error: checkError } = await supabase
      .from('thumbnails')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !existing) {
      return notFoundResponse('Thumbnail not found or access denied')
    }

    // Parse request body
    const body: ThumbnailUpdate = await request.json()
    
    // Validate title if provided
    if (body.title !== undefined && (!body.title || !body.title.trim())) {
      return validationErrorResponse('Title cannot be empty')
    }

    // Validate project_id if provided (must exist and belong to user)
    if (body.project_id !== undefined && body.project_id !== null) {
      const { data: project } = await getProjectById(supabase, body.project_id, user.id)
      if (!project) {
        return validationErrorResponse('Project not found or access denied')
      }
    }

    // Update thumbnail
    const { data: thumbnail, error: updateError } = await supabase
      .from('thumbnails')
      .update(body)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'PATCH /api/thumbnails/[id]',
        userId: user.id,
        operation: 'update-thumbnail',
        thumbnailId: id,
      })
      return databaseErrorResponse('Failed to update thumbnail')
    }

    return NextResponse.json({ thumbnail })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to update thumbnail', {
      route: 'PATCH /api/thumbnails/[id]',
    })
  }
}

/**
 * DELETE /api/thumbnails/[id]
 * Delete a thumbnail and its storage file
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Get thumbnail to find storage path
    const { data: thumbnail } = await supabase
      .from('thumbnails')
      .select('image_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!thumbnail) {
      return notFoundResponse('Thumbnail not found or access denied')
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('thumbnails')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (dbError) {
      logError(dbError, {
        route: 'DELETE /api/thumbnails/[id]',
        userId: user.id,
        operation: 'delete-thumbnail',
        thumbnailId: id,
      })
      return databaseErrorResponse('Failed to delete thumbnail')
    }

    // Delete from storage
    let storagePath: string | null = null
    
    if (thumbnail.image_url) {
      const signedUrlMatch = thumbnail.image_url.match(/\/storage\/v1\/object\/sign\/thumbnails\/([^?]+)/)
      if (signedUrlMatch) {
        storagePath = signedUrlMatch[1]
      }
    }
    
    // If we couldn't extract, try common extensions
    if (!storagePath) {
      const extensions = ['png', 'jpg', 'jpeg']
      for (const ext of extensions) {
        const path = `${user.id}/${id}/thumbnail.${ext}`
        const { error } = await supabase.storage
          .from('thumbnails')
          .remove([path])
        if (!error) {
          break // Successfully deleted
        }
      }
    } else {
      // Delete using extracted path
      await supabase.storage
        .from('thumbnails')
        .remove([storagePath])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to delete thumbnail', {
      route: 'DELETE /api/thumbnails/[id]',
    })
  }
}

