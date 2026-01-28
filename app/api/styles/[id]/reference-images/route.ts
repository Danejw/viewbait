/**
 * Style Reference Images API Route
 * 
 * Handles POST (add) and DELETE (remove) operations for style reference images.
 * All operations are server-side only for security.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  notFoundResponse,
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

/**
 * POST /api/styles/[id]/reference-images
 * Add reference images to a style
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Verify user owns the style
    const { data: existing, error: checkError } = await supabase
      .from('styles')
      .select('id, reference_images')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !existing) {
      return notFoundResponse('Style not found or access denied')
    }

    // Parse request body
    const body: { imageUrls: string[] } = await request.json()
    
    if (!Array.isArray(body.imageUrls)) {
      return validationErrorResponse('imageUrls must be an array')
    }

    // Merge with existing images
    const existingImages = (existing.reference_images as string[]) || []
    const newImages = [...existingImages, ...body.imageUrls]

    // Update style
    const { data: style, error: updateError } = await supabase
      .from('styles')
      .update({ 
        reference_images: newImages,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'POST /api/styles/[id]/reference-images',
        userId: user.id,
        operation: 'update-style-reference-images',
        styleId: id,
      })
      return databaseErrorResponse('Failed to add reference images')
    }

    return NextResponse.json({ style })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to add reference images')
  }
}

/**
 * DELETE /api/styles/[id]/reference-images
 * Remove a reference image from a style
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Parse query parameter for image URL
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')
    
    if (!imageUrl) {
      return validationErrorResponse('Image URL is required')
    }

    // Verify user owns the style and get current images
    const { data: existing, error: checkError } = await supabase
      .from('styles')
      .select('id, reference_images')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !existing) {
      return notFoundResponse('Style not found or access denied')
    }

    // Remove the image URL
    const existingImages = (existing.reference_images as string[]) || []
    const newImages = existingImages.filter((url: string) => url !== imageUrl)

    // Update style
    const { data: style, error: updateError } = await supabase
      .from('styles')
      .update({ 
        reference_images: newImages,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'DELETE /api/styles/[id]/reference-images',
        userId: user.id,
        operation: 'remove-style-reference-image',
        styleId: id,
      })
      return databaseErrorResponse('Failed to remove reference image')
    }

    return NextResponse.json({ style })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to remove reference image')
  }
}

