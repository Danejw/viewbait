/**
 * Experiment Variants API Route
 * 
 * Handles POST (generate variants) and PATCH (update variant) operations.
 * Generates 3 thumbnail variants (A/B/C) by calling /api/generate multiple times.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/server/utils/error-handler'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { GenerateThumbnailRequest } from '@/app/api/generate/route'

export interface GenerateVariantsRequest {
  title: string
  description?: string
  tags?: string[]
  emotion?: string
  pose?: string
  style?: string
  palette?: string
  resolution?: '1K' | '2K' | '4K'
  aspectRatio?: string
  referenceImages?: string[]
  faceImages?: string[]
  faceCharacters?: Array<{ images: string[] }>
  customStyle?: string
  thumbnailText?: string
}

export interface UpdateVariantRequest {
  title_text?: string
  thumbnail_asset_url?: string
  thumbnail_id?: string | null
}

/**
 * Generate 3 variants with slight variations in prompts
 */
function createVariantPrompts(baseRequest: GenerateVariantsRequest): GenerateThumbnailRequest[] {
  // Build context from description and tags
  const contextParts: string[] = []
  if (baseRequest.description) {
    contextParts.push(`Video description: ${baseRequest.description}`)
  }
  if (baseRequest.tags && baseRequest.tags.length > 0) {
    contextParts.push(`Video tags: ${baseRequest.tags.join(', ')}`)
  }
  const context = contextParts.length > 0 ? contextParts.join('. ') + '. ' : ''

  // Build base custom style with context
  let baseCustomStyle = baseRequest.customStyle || ''
  if (context) {
    // Add context with proper spacing
    baseCustomStyle = context + (baseCustomStyle ? ' ' + baseCustomStyle : '')
  }

  const base: GenerateThumbnailRequest = {
    title: baseRequest.title,
    emotion: baseRequest.emotion,
    pose: baseRequest.pose,
    style: baseRequest.style,
    palette: baseRequest.palette,
    resolution: baseRequest.resolution || '1K',
    aspectRatio: baseRequest.aspectRatio || '16:9',
    referenceImages: baseRequest.referenceImages,
    faceImages: baseRequest.faceImages,
    faceCharacters: baseRequest.faceCharacters,
    customStyle: baseCustomStyle,
    thumbnailText: baseRequest.thumbnailText,
  }

  // Variant A: Original prompt with context
  const variantA: GenerateThumbnailRequest = {
    ...base,
    thumbnailText: baseRequest.thumbnailText || baseRequest.title,
  }

  // Variant B: Slightly different composition/angle
  const variantB: GenerateThumbnailRequest = {
    ...base,
    thumbnailText: baseRequest.thumbnailText || baseRequest.title,
    customStyle: baseCustomStyle
      ? `${baseCustomStyle} Try a different camera angle or composition.`
      : 'Try a different camera angle or composition.',
  }

  // Variant C: Different color emphasis or mood
  const variantC: GenerateThumbnailRequest = {
    ...base,
    thumbnailText: baseRequest.thumbnailText || baseRequest.title,
    customStyle: baseCustomStyle
      ? `${baseCustomStyle} Experiment with different color emphasis or mood.`
      : 'Experiment with different color emphasis or mood.',
  }

  return [variantA, variantB, variantC]
}

/**
 * POST /api/experiments/[id]/variants
 * Generate 3 variants (A/B/C) for an experiment
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Verify experiment exists and belongs to user
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (expError || !experiment) {
      if (expError?.code === 'PGRST116') {
        return notFoundResponse('Experiment not found')
      }
      logError(expError, {
        route: 'POST /api/experiments/[id]/variants',
        userId: user.id,
        experimentId: id,
        operation: 'fetch-experiment',
      })
      return databaseErrorResponse('Failed to fetch experiment')
    }

    // Check for existing variants and delete them before generating new ones (prevents unique constraint violation)
    const { data: existingVariants } = await supabase
      .from('experiment_variants')
      .select('label')
      .eq('experiment_id', id)

    if (existingVariants && existingVariants.length > 0) {
      const { error: deleteError } = await supabase
        .from('experiment_variants')
        .delete()
        .eq('experiment_id', id)

      if (deleteError) {
        logError(deleteError, {
          route: 'POST /api/experiments/[id]/variants',
          userId: user.id,
          experimentId: id,
          operation: 'delete-existing-variants',
        })
        // Continue anyway - might still work if variants don't conflict
      }
    }

    // Parse request body
    const body: GenerateVariantsRequest = await request.json()

    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return validationErrorResponse('title is required')
    }

    // Create variant prompts
    const variantPrompts = createVariantPrompts(body)

    // Generate 3 thumbnails by calling /api/generate internally
    const variants = []
    const labels = ['A', 'B', 'C']

    // Get the base URL from the request
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`

    for (let i = 0; i < 3; i++) {
      try {
        // Call the generate API internally
        // Forward cookies to preserve auth session
        const cookies = request.headers.get('cookie') || ''
        const generateUrl = `${baseUrl}/api/generate`
        
        logInfo('Calling generate API for variant', {
          route: 'POST /api/experiments/[id]/variants',
          userId: user.id,
          experimentId: id,
          variant: labels[i],
          generateUrl,
          hasCookies: !!cookies,
          title: variantPrompts[i].title,
        })
        
        const generateResponse = await fetch(generateUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookies,
          },
          body: JSON.stringify(variantPrompts[i]),
        })

        if (!generateResponse.ok) {
          let errorMessage = 'Generation failed'
          let errorData: any = {}
          try {
            errorData = await generateResponse.json()
            errorMessage = errorData.error || errorData.message || `HTTP ${generateResponse.status}`
          } catch (e) {
            errorMessage = `HTTP ${generateResponse.status}: ${generateResponse.statusText}`
          }
          logError(new Error(errorMessage), {
            route: 'POST /api/experiments/[id]/variants',
            userId: user.id,
            experimentId: id,
            variant: labels[i],
            operation: 'generate-variant',
            status: generateResponse.status,
            errorData: errorData,
          })
          // Continue with other variants even if one fails
          continue
        }

        let generateData: any = {}
        try {
          generateData = await generateResponse.json()
        } catch (e) {
          logError(new Error('Failed to parse generate response'), {
            route: 'POST /api/experiments/[id]/variants',
            userId: user.id,
            experimentId: id,
            variant: labels[i],
            operation: 'parse-generate-response',
            error: e instanceof Error ? e.message : String(e),
          })
          continue
        }

        const imageUrl = generateData.imageUrl
        const thumbnailId = generateData.thumbnailId

        if (!imageUrl || !thumbnailId) {
          logError(new Error('Generated thumbnail missing imageUrl or thumbnailId'), {
            route: 'POST /api/experiments/[id]/variants',
            userId: user.id,
            experimentId: id,
            variant: labels[i],
            operation: 'validate-generate-response',
            responseData: generateData,
          })
          continue
        }

        // Create variant record
        const { data: variant, error: variantError } = await supabase
          .from('experiment_variants')
          .insert({
            experiment_id: id,
            label: labels[i],
            title_text: variantPrompts[i].thumbnailText || body.title,
            thumbnail_asset_url: imageUrl,
            thumbnail_id: thumbnailId,
          })
          .select()
          .single()

        if (variantError) {
          logError(variantError, {
            route: 'POST /api/experiments/[id]/variants',
            userId: user.id,
            experimentId: id,
            variant: labels[i],
            operation: 'create-variant',
          })
          continue
        }

        variants.push(variant)

        logInfo('Variant generated successfully', {
          route: 'POST /api/experiments/[id]/variants',
          userId: user.id,
          experimentId: id,
          variant: labels[i],
          thumbnailId: thumbnailId,
        })
      } catch (error) {
        logError(error, {
          route: 'POST /api/experiments/[id]/variants',
          userId: user.id,
          experimentId: id,
          variant: labels[i],
          operation: 'generate-variant',
        })
        // Continue with other variants
      }
    }

    if (variants.length === 0) {
      logError(new Error('All variant generation attempts failed'), {
        route: 'POST /api/experiments/[id]/variants',
        userId: user.id,
        experimentId: id,
        operation: 'generate-variants',
        attemptedVariants: 3,
        successfulVariants: 0,
      })
      return serverErrorResponse(
        new Error('Failed to generate any variants. Please check your credits and try again.'),
        'Failed to generate variants'
      )
    }

    // Update experiment status to 'ready_for_studio' if all variants generated
    if (variants.length === 3) {
      await supabase
        .from('experiments')
        .update({ status: 'ready_for_studio' })
        .eq('id', id)
    }

    return NextResponse.json({
      variants,
      count: variants.length,
    })
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to generate variants')
  }
}

/**
 * PATCH /api/experiments/[id]/variants
 * Update a variant (title or thumbnail)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Parse request body
    const body: UpdateVariantRequest & { label?: 'A' | 'B' | 'C' } = await request.json()

    if (!body.label) {
      return validationErrorResponse('label is required (A, B, or C)')
    }

    // Verify experiment exists and belongs to user
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (expError || !experiment) {
      if (expError?.code === 'PGRST116') {
        return notFoundResponse('Experiment not found')
      }
      return databaseErrorResponse('Failed to fetch experiment')
    }

    // Build update object
    const updateData: Partial<UpdateVariantRequest> = {}
    if (body.title_text !== undefined) updateData.title_text = body.title_text.trim()
    if (body.thumbnail_asset_url !== undefined) updateData.thumbnail_asset_url = body.thumbnail_asset_url
    if (body.thumbnail_id !== undefined) updateData.thumbnail_id = body.thumbnail_id

    // Update variant
    const { data: variant, error: updateError } = await supabase
      .from('experiment_variants')
      .update(updateData)
      .eq('experiment_id', id)
      .eq('label', body.label)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return notFoundResponse('Variant not found')
      }
      logError(updateError, {
        route: 'PATCH /api/experiments/[id]/variants',
        userId: user.id,
        experimentId: id,
        variant: body.label,
        operation: 'update-variant',
      })
      return databaseErrorResponse('Failed to update variant')
    }

    return NextResponse.json({ variant })
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to update variant')
  }
}
