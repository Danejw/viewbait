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
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { GenerateThumbnailRequest } from '@/app/api/generate/route'
import { replaceExperimentVariant } from '@/lib/server/data/experiment-variants'

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

    let body: GenerateSingleVariantRequest
    try {
      body = await request.json()
    } catch {
      return validationErrorResponse('Invalid JSON body')
    }

    // Validate required fields before touching existing variants
    if (!body?.title || !body.title.trim()) {
      return validationErrorResponse('title is required')
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
      let errorData: { error?: string; message?: string } = {}
      try {
        errorData = await generateResponse.json()
        errorMessage = errorData.error || errorData.message || `HTTP ${generateResponse.status}`
      } catch {
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

    let generateData: { imageUrl?: string; thumbnailId?: string } = {}
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

    // Replace variant in place so a failed regeneration cannot wipe the existing row
    const { data: variant, error: variantError } = await replaceExperimentVariant(
      supabase,
      {
        experimentId: id,
        label: label as 'A' | 'B' | 'C',
        titleText: variantPrompt.thumbnailText || body.title,
        thumbnailAssetUrl: imageUrl,
        thumbnailId: thumbnailId,
      }
    )

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
