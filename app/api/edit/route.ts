/**
 * Thumbnail Edit API Route
 * 
 * Handles thumbnail editing using Google Gemini API.
 * Handles authentication, credit checks, and database updates.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { callGeminiImageEdit } from '@/lib/services/ai-core'
import { fetchImageAsBase64 } from '@/lib/utils/ai-helpers'
import { logError } from '@/lib/server/utils/logger'
import { generateThumbnailVariants } from '@/lib/server/utils/image-variants'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshSignedUrl } from '@/lib/server/utils/url-refresh'
import { sanitizeErrorForClient } from '@/lib/utils/error-sanitizer'
import { decrementCreditsAtomic, incrementCreditsAtomic } from '@/lib/server/utils/credits'
import { TimeoutError } from '@/lib/utils/retry-with-backoff'
import {
  validationErrorResponse,
  notFoundResponse,
  subscriptionErrorResponse,
  insufficientCreditsResponse,
  configErrorResponse,
  aiServiceErrorResponse,
  databaseErrorResponse,
  storageErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { getEditCreditCost } from '@/lib/server/data/subscription-tiers'

export interface EditThumbnailRequest {
  thumbnailId: string
  editPrompt: string
  referenceImages?: string[] // Optional reference images for editing
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body: EditThumbnailRequest = await request.json()
    
    // Validate required fields
    if (!body.thumbnailId || !body.editPrompt?.trim()) {
      return validationErrorResponse('Thumbnail ID and edit prompt are required')
    }

    // Validate edit prompt length (max 500 chars per backend docs)
    if (body.editPrompt.length > 500) {
      return validationErrorResponse('Edit prompt must be 500 characters or less')
    }

    // Verify user owns the thumbnail
    const { data: thumbnail, error: thumbError } = await supabase
      .from('thumbnails')
      .select('*')
      .eq('id', body.thumbnailId)
      .eq('user_id', user.id)
      .single()

    if (thumbError || !thumbnail) {
      return notFoundResponse('Thumbnail not found or access denied')
    }

    // Get user subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (subError && subError.code !== 'PGRST116') {
      return subscriptionErrorResponse('Failed to fetch subscription')
    }

    const creditsRemaining = subscription?.credits_remaining ?? 10
    const editCreditCost = await getEditCreditCost()

    // Check credits
    if (creditsRemaining < editCreditCost) {
      return insufficientCreditsResponse(creditsRemaining, editCreditCost)
    }

    // Sanitize edit prompt (remove control characters)
    const sanitizedPrompt = body.editPrompt.replace(/[\x00-\x1F\x7F]/g, '').trim()

    // Check if AI service is configured
    if (!process.env.GEMINI_API_KEY) {
      return configErrorResponse('AI service not configured')
    }

    // Get original thumbnail image URL
    // The image_url might be an expired signed URL, so we need to refresh it
    const fallbackPath = `${user.id}/${thumbnail.id}/thumbnail.png`
    const refreshedImageUrl = await refreshSignedUrl(
      supabase,
      'thumbnails',
      thumbnail.image_url,
      fallbackPath
    )

    // Fetch original image using refreshed URL
    const originalImage = await fetchImageAsBase64(refreshedImageUrl)
    if (!originalImage) {
      return aiServiceErrorResponse(
        new Error('Failed to fetch original thumbnail image'),
        'Failed to fetch original thumbnail image',
        { route: 'POST /api/edit', userId: user.id }
      )
    }

    // Process reference images if provided
    const referenceImages = body.referenceImages || []
    const processedReferenceImages: Array<{ data: string; mimeType: string }> = []
    
    if (referenceImages.length > 0) {
      for (const refImageUrl of referenceImages) {
        const refImage = await fetchImageAsBase64(refImageUrl)
        if (refImage) {
          processedReferenceImages.push(refImage)
        }
      }
    }

    // Build structured edit prompt that clearly indicates image editing task
    // The prompt should instruct the model to generate a modified version of the original image
    const structuredEditPrompt = `Generate a new thumbnail image based on the provided reference image. Apply the following modifications: ${sanitizedPrompt}

Requirements:
- Maintain the same aspect ratio and composition style as the reference image
- Keep the core visual elements and layout
- Apply the requested modifications while preserving the overall thumbnail aesthetic
- Generate a high-quality thumbnail image that matches the style and quality of the reference`

    // Deduct credits upfront (before generation) to enable refunds on failure
    const supabaseService = createServiceClient()
    const idempotencyKey = crypto.randomUUID()
    
    const creditResult = await decrementCreditsAtomic(
      supabaseService,
      user.id,
      editCreditCost,
      idempotencyKey,
      null, // Will be set after thumbnail is created
      `Editing thumbnail: ${sanitizedPrompt.substring(0, 50)}`,
      'edit'
    )

    // Handle atomic function results
    if (!creditResult.success) {
      if (creditResult.reason === 'INSUFFICIENT') {
        return insufficientCreditsResponse(creditsRemaining, editCreditCost)
      }
      
      logError(new Error(`Credit deduction failed: ${creditResult.reason}`), {
        route: 'POST /api/edit',
        userId: user.id,
        operation: 'atomic-credit-decrement-edit',
        idempotencyKey,
      })
      return databaseErrorResponse('Failed to deduct credits')
    }

    // If duplicate (idempotent retry), check if edited thumbnail already exists
    if (creditResult.duplicate) {
      // For duplicate requests, we'd need to track which thumbnail was created
      // For now, continue with generation (idempotency prevents double-charge)
    }

    // Call AI core service to edit thumbnail
    // Note: editPrompt is user input, but it's sanitized and limited to 500 chars
    let aiResult
    let generationFailed = false
    let timeoutOccurred = false
    
    try {
      aiResult = await callGeminiImageEdit(
        structuredEditPrompt,
        originalImage,
        processedReferenceImages.length > 0 ? processedReferenceImages : undefined
      )
    } catch (error) {
      generationFailed = true
      timeoutOccurred = error instanceof TimeoutError
      
      // Refund credits if generation failed after deduction
      const refundIdempotencyKey = crypto.randomUUID()
      const refundResult = await incrementCreditsAtomic(
        supabaseService,
        user.id,
        editCreditCost,
        refundIdempotencyKey,
        `Refund for failed thumbnail edit: ${timeoutOccurred ? 'timeout' : 'generation error'}`,
        'refund'
      )

      let refundFailureWarning: { amount: number; reason: string; requestId: string } | null = null

      if (!refundResult.success) {
        // Log refund failure (critical - should not happen)
        logError(new Error(`Credit refund failed: ${refundResult.reason}`), {
          route: 'POST /api/edit',
          userId: user.id,
          operation: 'atomic-credit-refund-edit',
          idempotencyKey: refundIdempotencyKey,
          originalIdempotencyKey: idempotencyKey,
        })
        
        // Track refund failure to notify user
        refundFailureWarning = {
          amount: editCreditCost,
          reason: refundResult.reason || 'UNKNOWN',
          requestId: idempotencyKey,
        }
      }

      return NextResponse.json(
        { 
          error: sanitizeErrorForClient(error, 'edit-thumbnail-ai', timeoutOccurred ? 'Generation timed out' : 'Failed to edit thumbnail'),
          code: timeoutOccurred ? 'TIMEOUT_ERROR' : 'AI_SERVICE_ERROR',
          ...(refundFailureWarning && { refundFailureWarning }),
        },
        { status: 500 }
      )
    }

    if (!aiResult) {
      generationFailed = true
      
      // Refund credits if generation failed
      const refundIdempotencyKey = crypto.randomUUID()
      const refundResult = await incrementCreditsAtomic(
        supabaseService,
        user.id,
        editCreditCost,
        refundIdempotencyKey,
        'Refund for failed thumbnail edit: no result',
        'refund'
      )

      let refundFailureWarning: { amount: number; reason: string; requestId: string } | null = null

      if (!refundResult.success) {
        logError(new Error(`Credit refund failed: ${refundResult.reason}`), {
          route: 'POST /api/edit',
          userId: user.id,
          operation: 'atomic-credit-refund-edit',
          idempotencyKey: refundIdempotencyKey,
        })
        
        // Track refund failure to notify user
        refundFailureWarning = {
          amount: editCreditCost,
          reason: refundResult.reason || 'UNKNOWN',
          requestId: idempotencyKey,
        }
      }

      return NextResponse.json(
        { 
          error: 'Failed to edit thumbnail',
          code: 'AI_SERVICE_ERROR',
          ...(refundFailureWarning && { refundFailureWarning }),
        },
        { status: 500 }
      )
    }

    // Convert base64 to blob and upload to storage
    const imageBuffer = Buffer.from(aiResult.imageData, 'base64')
    const imageBlob = new Blob([imageBuffer], { type: aiResult.mimeType })
    
    // Create a new thumbnail record (new version) instead of updating the original
    const fileExtension = aiResult.mimeType.includes('jpeg') || aiResult.mimeType.includes('jpg') ? 'jpg' : 'png'
    
    // Create new thumbnail record first to get new ID
    const { data: newThumbnail, error: insertError } = await supabase
      .from('thumbnails')
      .insert({
        user_id: user.id,
        title: thumbnail.title, // Keep original title
        image_url: '', // Will be updated after upload
        style: thumbnail.style,
        palette: thumbnail.palette,
        emotion: thumbnail.emotion,
        aspect_ratio: thumbnail.aspect_ratio,
        resolution: thumbnail.resolution || null, // Preserve original resolution
        has_watermark: thumbnail.has_watermark,
        liked: false, // New version starts as not favorited
      })
      .select()
      .single()

    if (insertError || !newThumbnail) {
      logError(insertError || new Error('Failed to create new thumbnail record'), {
        route: 'POST /api/edit',
        userId: user.id,
        operation: 'create-new-thumbnail-version',
        originalThumbnailId: body.thumbnailId,
      })
      return NextResponse.json(
        { error: 'Failed to create new thumbnail version', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    const newThumbnailId = newThumbnail.id
    const storagePath = `${user.id}/${newThumbnailId}/thumbnail.${fileExtension}`
    
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(storagePath, imageBlob, {
        contentType: aiResult.mimeType,
        upsert: false, // Don't overwrite - this is a new file
      })

    if (uploadError) {
      // Clean up the database record if upload fails
      await supabase.from('thumbnails').delete().eq('id', newThumbnailId)
      
      // Refund credits if storage upload fails after generation
      const refundIdempotencyKey = crypto.randomUUID()
      const refundResult = await incrementCreditsAtomic(
        supabaseService,
        user.id,
        editCreditCost,
        refundIdempotencyKey,
        'Refund for failed thumbnail edit: storage upload failed',
        'refund'
      )

      let refundFailureWarning: { amount: number; reason: string; requestId: string } | null = null

      if (!refundResult.success) {
        logError(new Error(`Credit refund failed: ${refundResult.reason}`), {
          route: 'POST /api/edit',
          userId: user.id,
          operation: 'atomic-credit-refund-edit-storage',
          idempotencyKey: refundIdempotencyKey,
        })
        
        // Track refund failure to notify user
        refundFailureWarning = {
          amount: editCreditCost,
          reason: refundResult.reason || 'UNKNOWN',
          requestId: idempotencyKey,
        }
      }
      
      // Include refund failure warning in error response
      const errorResponse = storageErrorResponse(
        uploadError,
        'Failed to upload edited thumbnail',
        { route: 'POST /api/edit', userId: user.id }
      )
      
      // Add refund failure warning to response if present
      if (refundFailureWarning) {
        const errorData = await errorResponse.json()
        return NextResponse.json(
          {
            ...errorData,
            refundFailureWarning,
          },
          { status: errorResponse.status }
        )
      }
      
      return errorResponse
    }

    // Generate thumbnail variants (400w and 800w)
    const { variant400w, variant800w } = await generateThumbnailVariants(imageBuffer, aiResult.mimeType)
    
    let thumbnail400wUrl: string | null = null
    let thumbnail800wUrl: string | null = null

    // Upload 400w variant if generated
    if (variant400w) {
      const variant400wPath = `${user.id}/${newThumbnailId}/${variant400w.path}`
      const { error: variant400wError } = await supabase.storage
        .from('thumbnails')
        .upload(variant400wPath, variant400w.buffer, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '31536000', // 1 year cache
        })

      if (!variant400wError) {
        const { data: variant400wUrlData } = await supabase.storage
          .from('thumbnails')
          .createSignedUrl(variant400wPath, 60 * 60 * 24 * 365) // 1 year expiry
        thumbnail400wUrl = variant400wUrlData?.signedUrl || null
      } else {
        logError(variant400wError, {
          route: 'POST /api/edit',
          userId: user.id,
          operation: 'upload-400w-variant',
          thumbnailId: newThumbnailId,
        })
      }
    }

    // Upload 800w variant if generated
    if (variant800w) {
      const variant800wPath = `${user.id}/${newThumbnailId}/${variant800w.path}`
      const { error: variant800wError } = await supabase.storage
        .from('thumbnails')
        .upload(variant800wPath, variant800w.buffer, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '31536000', // 1 year cache
        })

      if (!variant800wError) {
        const { data: variant800wUrlData } = await supabase.storage
          .from('thumbnails')
          .createSignedUrl(variant800wPath, 60 * 60 * 24 * 365) // 1 year expiry
        thumbnail800wUrl = variant800wUrlData?.signedUrl || null
      } else {
        logError(variant800wError, {
          route: 'POST /api/edit',
          userId: user.id,
          operation: 'upload-800w-variant',
          thumbnailId: newThumbnailId,
        })
      }
    }

    // Get signed URL for the uploaded image
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('thumbnails')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 year expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      // Clean up the database record and storage file if URL creation fails
      await supabase.from('thumbnails').delete().eq('id', newThumbnailId)
      await supabase.storage.from('thumbnails').remove([storagePath])
      
      // Refund credits if URL creation fails
      const refundIdempotencyKey = crypto.randomUUID()
      const refundResult = await incrementCreditsAtomic(
        supabaseService,
        user.id,
        editCreditCost,
        refundIdempotencyKey,
        'Refund for failed thumbnail edit: URL creation failed',
        'refund'
      )

      let refundFailureWarning: { amount: number; reason: string; requestId: string } | null = null

      if (!refundResult.success) {
        logError(new Error(`Credit refund failed: ${refundResult.reason}`), {
          route: 'POST /api/edit',
          userId: user.id,
          operation: 'atomic-credit-refund-edit-url',
          idempotencyKey: refundIdempotencyKey,
        })
        
        // Track refund failure to notify user
        refundFailureWarning = {
          amount: editCreditCost,
          reason: refundResult.reason || 'UNKNOWN',
          requestId: idempotencyKey,
        }
      }
      
      // Include refund failure warning in error response
      const errorResponse = storageErrorResponse(
        signedUrlError || new Error('No signed URL data'),
        'Failed to create image URL',
        { route: 'POST /api/edit', userId: user.id }
      )
      
      // Add refund failure warning to response if present
      if (refundFailureWarning) {
        const errorData = await errorResponse.json()
        return NextResponse.json(
          {
            ...errorData,
            refundFailureWarning,
          },
          { status: errorResponse.status }
        )
      }
      
      return errorResponse
    }

    const newImageUrl = signedUrlData.signedUrl

    // Update the new thumbnail record with the image URL
    // Note: variant URLs (thumbnail_400w_url, thumbnail_800w_url) are optional columns
    // that may not exist in all database schemas, so we only update them if they have values
    const updateData: {
      image_url: string
      thumbnail_400w_url?: string | null
      thumbnail_800w_url?: string | null
    } = {
      image_url: newImageUrl,
    }

    // Only include variant URLs if they exist and the columns are available
    // These columns are optional and may not exist in all database schemas
    if (thumbnail400wUrl !== null) {
      updateData.thumbnail_400w_url = thumbnail400wUrl
    }
    if (thumbnail800wUrl !== null) {
      updateData.thumbnail_800w_url = thumbnail800wUrl
    }

    const { error: updateError } = await supabase
      .from('thumbnails')
      .update(updateData)
      .eq('id', newThumbnailId)
      .eq('user_id', user.id)

    if (updateError) {
      // Check if the error is about missing columns (variant URLs may not exist in schema)
      const errorMessage = updateError.message || String(updateError)
      const isMissingColumnError = 
        errorMessage.includes('thumbnail_400w_url') || 
        errorMessage.includes('thumbnail_800w_url') ||
        (errorMessage.includes('column') && errorMessage.includes('schema cache'))

      if (isMissingColumnError) {
        // Retry update without variant URLs (columns don't exist in schema)
        const { error: retryError } = await supabase
          .from('thumbnails')
          .update({ image_url: newImageUrl })
          .eq('id', newThumbnailId)
          .eq('user_id', user.id)

        if (retryError) {
          logError(retryError, {
            route: 'POST /api/edit',
            userId: user.id,
            operation: 'update-new-thumbnail-retry',
            thumbnailId: newThumbnailId,
          })
          return NextResponse.json(
            { error: 'Failed to update thumbnail record', code: 'DATABASE_ERROR' },
            { status: 500 }
          )
        }
        // Successfully updated without variant URLs
      } else {
        // Different error - log and return
        logError(updateError, {
          route: 'POST /api/edit',
          userId: user.id,
          operation: 'update-new-thumbnail',
          thumbnailId: newThumbnailId,
        })
        return NextResponse.json(
          { error: 'Failed to update thumbnail record', code: 'DATABASE_ERROR' },
          { status: 500 }
        )
      }
    }

    // Credits were already deducted upfront, so we just use the remaining credits from that deduction
    const newCreditsRemaining = creditResult.remaining ?? creditsRemaining - editCreditCost

    return NextResponse.json({
      imageUrl: newImageUrl,
      thumbnailId: newThumbnailId, // Return new thumbnail ID
      originalThumbnailId: body.thumbnailId, // Also return original ID for reference
      creditsUsed: editCreditCost,
      creditsRemaining: newCreditsRemaining,
    })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to edit thumbnail', {
      route: 'POST /api/edit',
    })
  }
}
