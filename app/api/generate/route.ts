/**
 * Thumbnail Generation API Route
 * 
 * Handles thumbnail generation using Google Gemini API.
 * Handles authentication, credit checks, and database operations.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { type Resolution } from '@/lib/constants/subscription-tiers'
import { getTierByProductId, getResolutionCredits } from '@/lib/server/data/subscription-tiers'
import { getTierForUser } from '@/lib/server/utils/tier'
import { callGeminiImageGeneration } from '@/lib/services/ai-core'
import { getEmotionDescription, getPoseDescription } from '@/lib/utils/ai-helpers'
import { logError } from '@/lib/server/utils/logger'
import { generateThumbnailVariants } from '@/lib/server/utils/image-variants'
import { requireAuth } from '@/lib/server/utils/auth'
import { decrementCreditsAtomic, incrementCreditsAtomic } from '@/lib/server/utils/credits'
import { isUUID, validateStyleIdentifier } from '@/lib/server/utils/uuid-validation'
import { TimeoutError } from '@/lib/utils/retry-with-backoff'
import {
  validationErrorResponse,
  subscriptionErrorResponse,
  insufficientCreditsResponse,
  tierLimitResponse,
  configErrorResponse,
  databaseErrorResponse,
  storageErrorResponse,
  serverErrorResponse,
  aiServiceErrorResponse,
} from '@/lib/server/utils/error-handler'

export interface GenerateThumbnailRequest {
  title: string
  emotion?: string
  pose?: string
  style?: string
  palette?: string
  resolution?: Resolution
  aspectRatio?: string
  referenceImages?: string[]
  faceImages?: string[] // DEPRECATED - keep for backward compatibility
  faceCharacters?: Array<{ images: string[] }> // NEW - grouped by character
  customStyle?: string
  thumbnailText?: string
  variations?: number // Number of variations to generate (1-4, default: 1)
}

/**
 * Build reference image order markers for prompt
 * Now supports character grouping
 */
function buildImageReferenceMarkers(
  styleRefCount: number, 
  faceCharacters: Array<{ images: string[] }>
): string {
  const totalFaceImages = faceCharacters.reduce((sum, char) => sum + char.images.length, 0)
  
  if (styleRefCount === 0 && totalFaceImages === 0) {
    return ''
  }
  
  const markers: string[] = ['REFERENCE IMAGES ORDER:']
  let currentPosition = 1
  
  if (styleRefCount > 0) {
    const positions = Array.from({ length: styleRefCount }, (_, i) => i + 1).join(', ')
    markers.push(`- Images ${positions}: Style references (match visual style, color grading, composition)`)
    currentPosition += styleRefCount
  }
  
  if (totalFaceImages > 0) {
    faceCharacters.forEach((char, charIndex) => {
      const startPos = currentPosition
      const endPos = currentPosition + char.images.length - 1
      const positions = char.images.length === 1 
        ? `${startPos}` 
        : `${startPos}-${endPos}`
      markers.push(`- Images ${positions}: Character ${charIndex + 1} facial references (${char.images.length} images of the same person)`)
      currentPosition += char.images.length
    })
  }
  
  return markers.join('\n')
}

/**
 * Result of generating a single variation
 */
interface SingleVariationResult {
  success: boolean
  thumbnailId?: string
  imageUrl?: string
  error?: string
}

/**
 * Generate a single thumbnail variation
 * This is a helper function used for both single and batch generation
 */
async function generateSingleVariation(
  supabase: ReturnType<typeof createClient>,
  user: { id: string },
  thumbnailId: string,
  body: GenerateThumbnailRequest,
  requestedResolution: Resolution,
  tier: Awaited<ReturnType<typeof getTierByProductId>>,
  prompt: string,
  referenceImages: string[],
  allFaceImages: string[],
  aspectRatio: string
): Promise<SingleVariationResult> {
  try {
    // Generate thumbnail image using AI core service
    let aiResult
    try {
      aiResult = await callGeminiImageGeneration(
        prompt,
        referenceImages,
        allFaceImages,
        requestedResolution,
        aspectRatio
      )
    } catch (error) {
      // Handle timeout errors specifically
      if (error instanceof TimeoutError) {
        return {
          success: false,
          thumbnailId,
          error: 'Generation timed out',
        }
      }
      throw error
    }

    if (!aiResult) {
      return {
        success: false,
        thumbnailId,
        error: 'Failed to generate thumbnail',
      }
    }

    // Convert base64 image data to buffer/blob
    const imageBuffer = Buffer.from(aiResult.imageData, 'base64')
    const imageBlob = new Blob([imageBuffer], { type: aiResult.mimeType })
    
    // Upload to storage with user-scoped path: {user_id}/{thumbnail_id}/thumbnail.{ext}
    const fileExtension = aiResult.mimeType.includes('jpeg') || aiResult.mimeType.includes('jpg') ? 'jpg' : 'png'
    const storagePath = `${user.id}/${thumbnailId}/thumbnail.${fileExtension}`
    
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(storagePath, imageBlob, {
        contentType: aiResult.mimeType,
        upsert: true,
      })

    if (uploadError) {
      return {
        success: false,
        thumbnailId,
        error: 'Failed to upload thumbnail to storage',
      }
    }

    // Generate thumbnail variants (400w and 800w)
    const { variant400w, variant800w } = await generateThumbnailVariants(imageBuffer, aiResult.mimeType)
    
    let thumbnail400wUrl: string | null = null
    let thumbnail800wUrl: string | null = null

    // Upload 400w variant if generated
    if (variant400w) {
      const variant400wPath = `${user.id}/${thumbnailId}/${variant400w.path}`
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
          route: 'POST /api/generate',
          userId: user.id,
          operation: 'upload-400w-variant',
          thumbnailId,
        })
      }
    }

    // Upload 800w variant if generated
    if (variant800w) {
      const variant800wPath = `${user.id}/${thumbnailId}/${variant800w.path}`
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
          route: 'POST /api/generate',
          userId: user.id,
          operation: 'upload-800w-variant',
          thumbnailId,
        })
      }
    }

    // Get signed URL for the uploaded image (bucket is private)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('thumbnails')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 year expiry
    
    if (signedUrlError || !signedUrlData?.signedUrl) {
      return {
        success: false,
        thumbnailId,
        error: 'Failed to create image URL',
      }
    }
    
    const generatedImageUrl = signedUrlData.signedUrl

    // Update thumbnail record with the storage URL and variant URLs
    const updateData: {
      image_url: string
      thumbnail_400w_url?: string | null
      thumbnail_800w_url?: string | null
    } = {
      image_url: generatedImageUrl,
    }

    if (thumbnail400wUrl !== null) {
      updateData.thumbnail_400w_url = thumbnail400wUrl
    }
    if (thumbnail800wUrl !== null) {
      updateData.thumbnail_800w_url = thumbnail800wUrl
    }

    const { error: updateError } = await supabase
      .from('thumbnails')
      .update(updateData)
      .eq('id', thumbnailId)
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
          .update({ image_url: generatedImageUrl })
          .eq('id', thumbnailId)
          .eq('user_id', user.id)

        if (retryError) {
          logError(retryError, {
            route: 'POST /api/generate',
            userId: user.id,
            operation: 'update-thumbnail-image-url-retry',
            thumbnailId,
          })
          return {
            success: false,
            thumbnailId,
            error: 'Failed to update thumbnail record',
          }
        }
      } else {
        logError(updateError, {
          route: 'POST /api/generate',
          userId: user.id,
          operation: 'update-thumbnail-image-url',
          thumbnailId,
        })
        return {
          success: false,
          thumbnailId,
          error: 'Failed to update thumbnail record',
        }
      }
    }

    return {
      success: true,
      thumbnailId,
      imageUrl: generatedImageUrl,
    }
  } catch (error) {
    // Handle timeout errors
    if (error instanceof TimeoutError) {
      return {
        success: false,
        thumbnailId,
        error: 'Generation timed out',
      }
    }

    // Log and return error
    logError(error, {
      route: 'POST /api/generate',
      userId: user.id,
      operation: 'generate-single-variation',
      thumbnailId,
    })

    return {
      success: false,
      thumbnailId,
      error: error instanceof Error ? error.message : 'Failed to generate thumbnail',
    }
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body: GenerateThumbnailRequest = await request.json()
    
    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return validationErrorResponse('Title is required')
    }

    // Validate variations parameter (1-4, default: 1)
    const variations = body.variations ?? 1
    if (variations < 1 || variations > 4) {
      return validationErrorResponse('Variations must be between 1 and 4')
    }

    // Get user tier and subscription (tier for limits, subscription for credits)
    const [tier, subscriptionResult] = await Promise.all([
      getTierForUser(supabase, user.id),
      supabase.from('user_subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    if (subscriptionResult.error) {
      return subscriptionErrorResponse('Failed to fetch subscription')
    }

    const subscription = subscriptionResult.data
    const creditsRemaining = subscription?.credits_remaining ?? 10

    // Cap variations by tier
    if (variations > tier.max_variations) {
      return tierLimitResponse(
        `Your plan allows up to ${tier.max_variations} variation(s). Upgrade for more.`
      )
    }

    // Restrict custom style/palette/face usage to Starter+
    const hasCustomAssets =
      !!body.style ||
      !!body.palette ||
      (body.faceCharacters?.length ?? 0) > 0 ||
      (body.faceImages?.length ?? 0) > 0
    if (!tier.can_create_custom && hasCustomAssets) {
      return tierLimitResponse(
        'Custom styles, palettes, and face references require Starter or higher.'
      )
    }

    // Validate resolution access
    const requestedResolution = (body.resolution || '1K') as Resolution
    if (!tier.allowed_resolutions.includes(requestedResolution)) {
      return tierLimitResponse(`Resolution ${requestedResolution} not available for your tier`)
    }

    // Validate aspect ratio access
    const requestedAspectRatio = body.aspectRatio || '16:9'
    if (!tier.allowed_aspect_ratios.includes(requestedAspectRatio)) {
      return tierLimitResponse(`Aspect ratio ${requestedAspectRatio} not available for your tier`)
    }

    // Check credits for batch (total cost = cost per variation * number of variations)
    const resolutionCredits = await getResolutionCredits()
    const creditCost = resolutionCredits[requestedResolution]
    const totalCreditCost = creditCost * variations
    if (creditsRemaining < totalCreditCost) {
      return insufficientCreditsResponse(creditsRemaining, totalCreditCost)
    }

    // Check if AI service is configured
    if (!process.env.GEMINI_API_KEY) {
      return configErrorResponse('AI service not configured')
    }

    // Look up style description if style name is provided
    let styleDescription: string | undefined
    if (body.style) {
      // Validate and sanitize style identifier to prevent injection
      const validatedStyle = validateStyleIdentifier(body.style)
      if (!validatedStyle) {
        return validationErrorResponse('Invalid style identifier format')
      }

      // Use safe query construction - check UUID first, then name
      let styleQuery = supabase
        .from('styles')
        .select('prompt, description')
      
      if (isUUID(validatedStyle)) {
        styleQuery = styleQuery.eq('id', validatedStyle)
      } else {
        styleQuery = styleQuery.eq('name', validatedStyle)
      }
      
      const { data: styleData } = await styleQuery.single()
      
      if (styleData) {
        styleDescription = styleData.prompt || styleData.description || validatedStyle
      } else {
        styleDescription = validatedStyle // Fallback to style name
      }
    }

    // Prepare initial thumbnail data (image_url will be updated after storage upload)
    const baseThumbnailData = {
      user_id: user.id,
      title: body.title.trim(),
      image_url: '', // Will be updated after storage upload
      style: body.style || null,
      palette: body.palette || null,
      emotion: body.emotion || null,
      aspect_ratio: requestedAspectRatio,
      resolution: requestedResolution,
      has_watermark: tier.has_watermark,
      liked: false,
    }

    // Create thumbnail records for all variations upfront
    const thumbnailRecords = Array.from({ length: variations }, () => baseThumbnailData)
    const { data: newThumbnails, error: insertError } = await supabase
      .from('thumbnails')
      .insert(thumbnailRecords)
      .select()

    if (insertError || !newThumbnails || newThumbnails.length !== variations) {
      logError(insertError || new Error('Failed to create thumbnail records'), {
        route: 'POST /api/generate',
        userId: user.id,
        operation: 'create-thumbnail-records',
      })
      return databaseErrorResponse('Failed to create thumbnail records')
    }

    const thumbnailIds = newThumbnails.map(t => t.id)

    // Build prompt using JSON structure (server-side only - prompts never exposed to frontend)
    const referenceImages = body.referenceImages || []

    // Handle both old (faceImages) and new (faceCharacters) formats
    let faceCharacters: Array<{ images: string[] }> = []
    let allFaceImages: string[] = []

    if (body.faceCharacters && body.faceCharacters.length > 0) {
      // New format: grouped by character
      faceCharacters = body.faceCharacters
      allFaceImages = faceCharacters.flatMap(char => char.images)
    } else if (body.faceImages && body.faceImages.length > 0) {
      // Old format: treat each image as separate character (backward compatibility)
      faceCharacters = body.faceImages.map(img => ({ images: [img] }))
      allFaceImages = body.faceImages
    }

    const aspectRatio = requestedAspectRatio
    const characterCount = faceCharacters.length

    // Look up palette name if provided
    let paletteName: string | null = null
    if (body.palette) {
      paletteName = body.palette
    }

    // Parse title for main title and subtext (split on colon)
    const titleParts = body.title.trim().split(':')
    const mainTitle = titleParts[0].trim()
    const subtext = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : null

    // Build image reference markers
    const imageMarkers = buildImageReferenceMarkers(referenceImages.length, faceCharacters)

    // Build character instructions
    let characterInstructions: string | null = null
    if (characterCount > 0) {
      characterInstructions = "Each character has multiple reference images showing the same person from different angles/expressions. Use ALL reference images for each character to accurately recreate their facial features and likeness. Be creative in how you embed them into the thumbnail design."
      
      if (characterCount > 1) {
        characterInstructions += ` There are ${characterCount} different characters to include in the scene.`
      }
      
      if (referenceImages.length > 0) {
        characterInstructions += " If a character is already in the style reference images, replace them with the new character(s)."
      }
    }

    // Get emotion and pose descriptions
    const emotionDescription = body.emotion ? getEmotionDescription(body.emotion) : null
    const poseDescription = body.pose && body.pose !== 'none' ? getPoseDescription(body.pose) : null

    // Build structured prompt data
    const promptData = {
      task: "thumbnail_generation",
      title: {
        main_title: mainTitle,
        subtext: subtext,
        instructions: "Use the title text EXACTLY as provided. The main_title should be prominent and the subtext (if provided) should be secondary/smaller. NO EXTRA TEXT. DO NOT CHANGE OR ADD TEXT."
      },
      style_requirements: {
        style: styleDescription || null,
        additional_notes: body.customStyle?.trim() || null,
        color_palette: paletteName
      },
      characters: {
        count: characterCount,
        facial_references_provided: characterCount > 0,
        reference_images_per_character: faceCharacters.map(char => char.images.length),
        emotional_tone: emotionDescription,
        pose: poseDescription,
        instructions: characterInstructions
      },
      technical_specs: {
        aspect_ratio: aspectRatio,
        resolution: requestedResolution,
        quality: "ultra high quality, professional YouTuber or movie-like thumbnail, eye-catching, high contrast, designed to maximize click-through rate"
      },
      reference_images: {
        style_references: {
          count: referenceImages.length,
          purpose: referenceImages.length > 0 
            ? "Match visual style, color grading, composition, and aesthetic of these images" 
            : null
        },
        facial_references: {
          total_images: allFaceImages.length,
          characters: faceCharacters.map((char, idx) => ({
            character_number: idx + 1,
            image_count: char.images.length,
            purpose: `Accurately recreate the facial features and likeness of character ${idx + 1} using all ${char.images.length} reference images`
          }))
        }
      }
    }

    // Build final prompt with markers + JSON
    const prompt = imageMarkers 
      ? `${imageMarkers}\n\n${JSON.stringify(promptData, null, 2)}`
      : JSON.stringify(promptData, null, 2)

    const supabaseService = createServiceClient()

    // For batch (variations > 1): Deduct credits upfront
    // For single (variations === 1): Deduct after generation (backward compatible)
    let creditResult: Awaited<ReturnType<typeof decrementCreditsAtomic>> | null = null
    let batchIdempotencyKey: string | null = null

    if (variations > 1) {
      // Batch mode: Deduct credits upfront
      batchIdempotencyKey = crypto.randomUUID()
      
      creditResult = await decrementCreditsAtomic(
        supabaseService,
        user.id,
        totalCreditCost,
        batchIdempotencyKey,
        null, // No single thumbnail ID for batch
        `Generated ${variations} ${requestedResolution} thumbnail variation(s): ${body.title.substring(0, 50)}`,
        'generation'
      )

      // Handle atomic function results
      if (!creditResult.success) {
        // Clean up all thumbnail records on credit deduction failure
        await supabase.from('thumbnails').delete().in('id', thumbnailIds)
        
        if (creditResult.reason === 'INSUFFICIENT') {
          return insufficientCreditsResponse(creditsRemaining, totalCreditCost)
        }
        
        // Database error or other failure
        logError(new Error(`Credit deduction failed: ${creditResult.reason}`), {
          route: 'POST /api/generate',
          userId: user.id,
          operation: 'atomic-credit-decrement-batch',
          thumbnailIds,
          idempotencyKey: batchIdempotencyKey,
        })
        return databaseErrorResponse('Failed to deduct credits')
      }

      // If duplicate (idempotent retry), we need to check if thumbnails already exist
      if (creditResult.duplicate) {
        // For duplicate batch requests, return existing thumbnails if they exist
        const { data: existingThumbnails } = await supabase
          .from('thumbnails')
          .select('id, image_url')
          .in('id', thumbnailIds)
          .eq('user_id', user.id)
          .not('image_url', 'is', null)

        if (existingThumbnails && existingThumbnails.length > 0) {
          // Return batch response with existing thumbnails
          const results = thumbnailIds.map(id => {
            const existing = existingThumbnails.find(t => t.id === id)
            return {
              success: !!existing,
              thumbnailId: id,
              imageUrl: existing?.image_url || undefined,
            }
          })

          return NextResponse.json({
            results,
            creditsUsed: totalCreditCost,
            creditsRemaining: creditResult.remaining ?? creditsRemaining - totalCreditCost,
            totalRequested: variations,
            totalSucceeded: existingThumbnails.length,
            totalFailed: variations - existingThumbnails.length,
          })
        }
      }
    }

    // Generate all variations in parallel
    const generationPromises = thumbnailIds.map(thumbnailId =>
      generateSingleVariation(
        supabase,
        user,
        thumbnailId,
        body,
        requestedResolution,
        tier,
        prompt,
        referenceImages,
        allFaceImages,
        aspectRatio
      )
    )

    const generationResults = await Promise.allSettled(generationPromises)
    
    // Process results and determine which succeeded/failed
    const results: SingleVariationResult[] = generationResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          success: false,
          thumbnailId: thumbnailIds[index],
          error: result.reason instanceof Error ? result.reason.message : 'Failed to generate thumbnail',
        }
      }
    })

    const successfulResults = results.filter(r => r.success)
    const failedResults = results.filter(r => !r.success)

    // Track refund failures to notify user
    let refundFailureWarning: { amount: number; reason: string; requestId: string } | null = null

    // Refund credits for failed variations
    if (failedResults.length > 0) {
      const refundAmount = creditCost * failedResults.length
      const refundIdempotencyKey = crypto.randomUUID()
      
      const refundResult = await incrementCreditsAtomic(
        supabaseService,
        user.id,
        refundAmount,
        refundIdempotencyKey,
        `Refund for ${failedResults.length} failed thumbnail generation(s)`,
        'refund'
      )

      if (!refundResult.success) {
        // Log refund failure (critical - should not happen)
        logError(new Error(`Credit refund failed: ${refundResult.reason}`), {
          route: 'POST /api/generate',
          userId: user.id,
          operation: 'atomic-credit-refund-batch',
          failedCount: failedResults.length,
          refundAmount,
          idempotencyKey: refundIdempotencyKey,
        })
        
        // Track refund failure to notify user
        refundFailureWarning = {
          amount: refundAmount,
          reason: refundResult.reason || 'UNKNOWN',
          requestId: batchIdempotencyKey || refundIdempotencyKey,
        }
      }

      // Clean up failed thumbnail records
      const failedThumbnailIds = failedResults
        .map(r => r.thumbnailId)
        .filter((id): id is string => !!id)
      
      if (failedThumbnailIds.length > 0) {
        await supabase.from('thumbnails').delete().in('id', failedThumbnailIds)
      }
    }

    // For single variation: Deduct credits after generation (backward compatible)
    if (variations === 1) {
      const singleResult = results[0]
      
      if (!singleResult.success) {
        // Clean up failed thumbnail record
        if (singleResult.thumbnailId) {
          await supabase.from('thumbnails').delete().eq('id', singleResult.thumbnailId)
        }
        
        return NextResponse.json(
          {
            error: singleResult.error || 'Failed to generate thumbnail',
            code: 'GENERATION_FAILED',
          },
          { status: 500 }
        )
      }

      // Deduct credits after successful generation (backward compatible)
      const singleIdempotencyKey = crypto.randomUUID()
      creditResult = await decrementCreditsAtomic(
        supabaseService,
        user.id,
        creditCost,
        singleIdempotencyKey,
        singleResult.thumbnailId,
        `Generated ${requestedResolution} thumbnail: ${body.title.substring(0, 50)}`,
        'generation'
      )

      if (!creditResult.success) {
        // Clean up thumbnail record on credit deduction failure
        if (singleResult.thumbnailId) {
          await supabase.from('thumbnails').delete().eq('id', singleResult.thumbnailId)
        }
        
        if (creditResult.reason === 'INSUFFICIENT') {
          return insufficientCreditsResponse(creditsRemaining, creditCost)
        }
        
        logError(new Error(`Credit deduction failed: ${creditResult.reason}`), {
          route: 'POST /api/generate',
          userId: user.id,
          operation: 'atomic-credit-decrement-single',
          thumbnailId: singleResult.thumbnailId,
          idempotencyKey: singleIdempotencyKey,
        })
        return databaseErrorResponse('Failed to deduct credits')
      }

      // If duplicate (idempotent retry), return success with existing result
      if (creditResult.duplicate) {
        return NextResponse.json({
          imageUrl: singleResult.imageUrl,
          thumbnailId: singleResult.thumbnailId,
          creditsUsed: creditCost,
          creditsRemaining: creditResult.remaining ?? creditsRemaining - creditCost,
        })
      }

      // Success: use remaining credits from atomic function
      const newCreditsRemaining = creditResult.remaining ?? creditsRemaining - creditCost

      return NextResponse.json({
        imageUrl: singleResult.imageUrl,
        thumbnailId: singleResult.thumbnailId,
        creditsUsed: creditCost,
        creditsRemaining: newCreditsRemaining,
      })
    }

    // For batch variations: Calculate final credits (accounting for refunds)
    const finalCreditsUsed = creditCost * successfulResults.length
    const finalCreditsRemaining = creditResult && creditResult.remaining !== undefined
      ? creditResult.remaining + (creditCost * failedResults.length) // Add back refunded credits
      : creditsRemaining - finalCreditsUsed

    // For batch variations, return batch response
    return NextResponse.json({
      results: results.map(r => ({
        success: r.success,
        thumbnailId: r.thumbnailId,
        imageUrl: r.imageUrl,
        error: r.error,
      })),
      creditsUsed: finalCreditsUsed,
      creditsRemaining: finalCreditsRemaining,
      totalRequested: variations,
      totalSucceeded: successfulResults.length,
      totalFailed: failedResults.length,
      ...(refundFailureWarning && { refundFailureWarning }),
    })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to generate thumbnail', {
      route: 'POST /api/generate',
    })
  }
}
