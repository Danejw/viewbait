/**
 * Single Variant Generation API Route
 * 
 * Handles POST to generate a single variant (A, B, or C) for an experiment.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
  notFoundResponse,
  forbiddenResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { GenerateThumbnailRequest } from '@/app/api/generate/route'
import { createServiceClient } from '@/lib/supabase/service'

export interface GenerateSingleVariantRequest {
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

/**
 * Create a single variant prompt
 */
function createVariantPrompt(
  baseRequest: GenerateSingleVariantRequest,
  label: 'A' | 'B' | 'C'
): GenerateThumbnailRequest {
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
    baseCustomStyle = context + (baseCustomStyle ? ' ' + baseCustomStyle : '')
  }

  // Add variant-specific instructions
  let variantStyle = baseCustomStyle
  if (label === 'B') {
    variantStyle = baseCustomStyle
      ? `${baseCustomStyle} Try a different camera angle or composition.`
      : 'Try a different camera angle or composition.'
  } else if (label === 'C') {
    variantStyle = baseCustomStyle
      ? `${baseCustomStyle} Experiment with different color emphasis or mood.`
      : 'Experiment with different color emphasis or mood.'
  }

  return {
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
    customStyle: variantStyle,
    thumbnailText: baseRequest.thumbnailText || baseRequest.title,
  }
}

/**
 * POST /api/experiments/[id]/variants/[label]
 * Generate a single variant (A, B, or C) for an experiment
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; label: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id, label } = await params

    // Validate label
    if (!['A', 'B', 'C'].includes(label)) {
      return validationErrorResponse('Label must be A, B, or C')
    }

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
        route: 'POST /api/experiments/[id]/variants/[label]',
        userId: user.id,
        experimentId: id,
        operation: 'fetch-experiment',
      })
      return databaseErrorResponse('Failed to fetch experiment')
    }

    // Check if variant already exists
    const { data: existingVariant } = await supabase
      .from('experiment_variants')
      .select('id')
      .eq('experiment_id', id)
      .eq('label', label)
      .single()

    // If variant exists, delete it first (allow regeneration)
    if (existingVariant) {
      const { error: deleteError } = await supabase
        .from('experiment_variants')
        .delete()
        .eq('id', existingVariant.id)

      if (deleteError) {
        logError(deleteError, {
          route: 'POST /api/experiments/[id]/variants/[label]',
          userId: user.id,
          experimentId: id,
          variant: label,
          operation: 'delete-existing-variant',
        })
        // Continue anyway - might still work
      }
    }

    // Parse request body
    const body: GenerateSingleVariantRequest = await request.json()

    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return validationErrorResponse('title is required')
    }

    // Create variant prompt
    const variantPrompt = createVariantPrompt(body, label as 'A' | 'B' | 'C')

    // Get the base URL from the request
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`

    // Call the generate API internally
    const cookies = request.headers.get('cookie') || ''
    const generateResponse = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies,
      },
      body: JSON.stringify(variantPrompt),
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
        route: 'POST /api/experiments/[id]/variants/[label]',
        userId: user.id,
        experimentId: id,
        variant: label,
        operation: 'generate-variant',
        status: generateResponse.status,
        errorData: errorData,
      })
      return serverErrorResponse(
        new Error(errorMessage),
        'Failed to generate variant'
      )
    }

    let generateData: any = {}
    try {
      generateData = await generateResponse.json()
    } catch (e) {
      logError(new Error('Failed to parse generate response'), {
        route: 'POST /api/experiments/[id]/variants/[label]',
        userId: user.id,
        experimentId: id,
        variant: label,
        operation: 'parse-generate-response',
        error: e instanceof Error ? e.message : String(e),
      })
      return serverErrorResponse(
        new Error('Failed to parse generation response'),
        'Failed to generate variant'
      )
    }

    const imageUrl = generateData.imageUrl
    const thumbnailId = generateData.thumbnailId

    if (!imageUrl || !thumbnailId) {
      logError(new Error('Generated thumbnail missing imageUrl or thumbnailId'), {
        route: 'POST /api/experiments/[id]/variants/[label]',
        userId: user.id,
        experimentId: id,
        variant: label,
        operation: 'validate-generate-response',
        responseData: generateData,
      })
      return serverErrorResponse(
        new Error('Generated thumbnail missing required data'),
        'Failed to generate variant'
      )
    }

    // Create variant record
    const { data: variant, error: variantError } = await supabase
      .from('experiment_variants')
      .insert({
        experiment_id: id,
        label: label as 'A' | 'B' | 'C',
        title_text: variantPrompt.thumbnailText || body.title,
        thumbnail_asset_url: imageUrl,
        thumbnail_id: thumbnailId,
      })
      .select()
      .single()

    if (variantError) {
      logError(variantError, {
        route: 'POST /api/experiments/[id]/variants/[label]',
        userId: user.id,
        experimentId: id,
        variant: label,
        operation: 'create-variant',
      })
      return databaseErrorResponse('Failed to create variant record')
    }

    // Update experiment status to 'ready_for_studio' if all variants now exist
    const { data: allVariants } = await supabase
      .from('experiment_variants')
      .select('label')
      .eq('experiment_id', id)

    if (allVariants && allVariants.length === 3) {
      await supabase
        .from('experiments')
        .update({ status: 'ready_for_studio' })
        .eq('id', id)
    }

    logInfo('Variant generated successfully', {
      route: 'POST /api/experiments/[id]/variants/[label]',
      userId: user.id,
      experimentId: id,
      variant: label,
      thumbnailId: thumbnailId,
    })

    return NextResponse.json({
      variant,
    })
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'generate-variant', undefined, 'Failed to generate variant')
  }
}
