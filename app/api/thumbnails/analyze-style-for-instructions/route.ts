/**
 * Analyze Thumbnail Style for Custom Instructions API Route
 *
 * Accepts a single thumbnail (by imageUrl or thumbnailId), analyzes its visual style
 * with Gemini, and returns a short description (max 500 chars) suitable for appending
 * to the generator's custom instructions field.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { callGeminiWithFunctionCalling } from '@/lib/services/ai-core'
import { fetchImageAsBase64 } from '@/lib/utils/ai-helpers'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshSignedUrl } from '@/lib/server/utils/url-refresh'
import {
  validationErrorResponse,
  configErrorResponse,
  aiServiceErrorResponse,
  notFoundResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

const MAX_DESCRIPTION_LENGTH = 500

export interface AnalyzeStyleForInstructionsRequest {
  imageUrl?: string
  thumbnailId?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const body: AnalyzeStyleForInstructionsRequest = await request.json()

    const hasImageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim().length > 0
    const hasThumbnailId = typeof body.thumbnailId === 'string' && body.thumbnailId.trim().length > 0

    if (!hasImageUrl && !hasThumbnailId) {
      return validationErrorResponse(
        'At least one of imageUrl or thumbnailId is required'
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return configErrorResponse('AI service not configured')
    }

    let imageData: { data: string; mimeType: string } | null = null

    if (hasThumbnailId) {
      const { data: thumbnail, error: thumbError } = await supabase
        .from('thumbnails')
        .select('id, image_url')
        .eq('id', body.thumbnailId!)
        .eq('user_id', user.id)
        .single()

      if (thumbError || !thumbnail) {
        return notFoundResponse('Thumbnail not found or access denied')
      }

      const fallbackPath = `${user.id}/${thumbnail.id}/thumbnail.png`
      const refreshedImageUrl = await refreshSignedUrl(
        supabase,
        'thumbnails',
        thumbnail.image_url ?? '',
        fallbackPath
      )

      imageData = await fetchImageAsBase64(refreshedImageUrl)
    }

    if (!imageData && hasImageUrl) {
      imageData = await fetchImageAsBase64(body.imageUrl!)
    }

    if (!imageData) {
      return aiServiceErrorResponse(
        new Error('Failed to fetch or process image'),
        'Failed to fetch or process image',
        { route: 'POST /api/thumbnails/analyze-style-for-instructions', userId: user.id }
      )
    }

    const systemPrompt = `You are an expert visual style analyst for thumbnails. Analyze the provided thumbnail image and describe its visual style in descriptive text suitable for "custom instructions" for AI thumbnail generation.

Rules:
- Output must not exceed ${MAX_DESCRIPTION_LENGTH} characters.
- Focus on: colors, lighting, composition, mood, text/typography style (do not transcribe actual text), and special effects (glow, shadows, gradients, etc.).
- Write in clear, concise prose. Do not use bullet points.
- Do not mention "YouTube" or platform names.
- The description will be appended to a user's custom instructions; make it actionable for an AI image generator.`

    const userPrompt = `Analyze this thumbnail image and describe its visual style. You MUST call the describe_thumbnail_style function with your analysis. Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`

    const toolDefinition = {
      name: 'describe_thumbnail_style',
      description: 'Return the thumbnail style description for custom instructions',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: `Visual style description for custom instructions, max ${MAX_DESCRIPTION_LENGTH} characters`,
          },
        },
        required: ['description'],
      },
    }

    let raw
    try {
      raw = await callGeminiWithFunctionCalling(
        systemPrompt,
        userPrompt,
        imageData,
        toolDefinition,
        'describe_thumbnail_style',
        'gemini-2.5-flash'
      )
    } catch (error) {
      return aiServiceErrorResponse(
        error,
        'Failed to analyze thumbnail style',
        {
          route: 'POST /api/thumbnails/analyze-style-for-instructions',
          userId: user.id,
        }
      )
    }

    const result = (raw as { functionCallResult?: { description?: string } })
      .functionCallResult ?? {}
    let description = (result.description ?? '').trim()
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      description = description.slice(0, MAX_DESCRIPTION_LENGTH)
    }

    return NextResponse.json({ description })
  } catch (error) {
    return handleApiError(error, 'POST /api/thumbnails/analyze-style-for-instructions', 'analyze-thumbnail-style', undefined, 'Failed to analyze thumbnail style')
  }
}
