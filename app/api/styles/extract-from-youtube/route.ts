/**
 * Extract Style from YouTube Thumbnails API Route
 *
 * Accepts multiple YouTube thumbnail URLs, fetches them, uploads to storage,
 * and calls Gemini to extract a common visual style across all images.
 * Returns name, description, prompt, and reference_images (storage URLs).
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { callGeminiWithFunctionCalling } from '@/lib/services/ai-core'
import { fetchImageAsBase64 } from '@/lib/utils/ai-helpers'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  configErrorResponse,
  aiServiceErrorResponse,
  serverErrorResponse,
  tierLimitResponse,
} from '@/lib/server/utils/error-handler'
import { getTierForUser } from '@/lib/server/utils/tier'
import { logError } from '@/lib/server/utils/logger'

const MIN_IMAGES = 2
const MAX_IMAGES = 10

export interface ExtractFromYouTubeRequest {
  imageUrls: string[]
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tier = await getTierForUser(supabase, user.id)
    if (!tier.can_create_custom) {
      return tierLimitResponse('Custom styles, palettes, and faces require Starter or higher.')
    }

    const body: ExtractFromYouTubeRequest = await request.json()
    if (!body.imageUrls || !Array.isArray(body.imageUrls)) {
      return validationErrorResponse('imageUrls array is required')
    }

    const imageUrls = body.imageUrls.filter((u): u is string => typeof u === 'string' && u.length > 0)
    if (imageUrls.length < MIN_IMAGES) {
      return validationErrorResponse(`Select at least ${MIN_IMAGES} thumbnails to extract a common style`)
    }
    if (imageUrls.length > MAX_IMAGES) {
      return validationErrorResponse(`Select at most ${MAX_IMAGES} thumbnails`)
    }

    if (!process.env.GEMINI_API_KEY) {
      return configErrorResponse('AI service not configured')
    }

    // 1. Fetch each URL as base64
    const imagePayloads: Array<{ data: string; mimeType: string }> = []
    for (let i = 0; i < imageUrls.length; i++) {
      const payload = await fetchImageAsBase64(imageUrls[i])
      if (!payload) {
        return validationErrorResponse(`Failed to fetch image ${i + 1}. Check that the URL is accessible.`)
      }
      imagePayloads.push(payload)
    }

    // 2. Upload each image to style-references and collect signed URLs
    const tempId = crypto.randomUUID()
    const referenceImages: string[] = []

    for (let i = 0; i < imagePayloads.length; i++) {
      const payload = imagePayloads[i]
      const ext = payload.mimeType === 'image/png' ? 'png' : 'jpg'
      const storagePath = `${user.id}/${tempId}-${i}.${ext}`

      const buffer = Buffer.from(payload.data, 'base64')
      const { error: uploadError } = await supabase.storage
        .from('style-references')
        .upload(storagePath, buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: payload.mimeType,
        })

      if (uploadError) {
        logError(uploadError, {
          route: 'POST /api/styles/extract-from-youtube',
          userId: user.id,
          operation: 'upload-thumbnail',
          index: i,
        })
        return NextResponse.json(
          { error: `Failed to save image ${i + 1}`, code: 'UPLOAD_ERROR' },
          { status: 500 }
        )
      }

      const { data: urlData } = await supabase.storage
        .from('style-references')
        .createSignedUrl(storagePath, 3600 * 24 * 365) // 1 year for reference images

      if (urlData?.signedUrl) {
        referenceImages.push(urlData.signedUrl)
      } else {
        referenceImages.push(`${storagePath}`)
      }
    }

    // 3. Call Gemini with all images and multi-image "common style" prompt
    const toolDefinition = {
      name: 'extract_style_info',
      description: 'Extract structured style information from the common visual style across the images',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'A catchy, memorable style name (2-4 words) like "Neon Cyberpunk", "Vintage Film Noir", "Bold Pop Art"',
          },
          description: {
            type: 'string',
            description: 'A brief 1-2 sentence description of what makes this style distinctive',
          },
          prompt: {
            type: 'string',
            description:
              'A detailed generation prompt (100-200 words) describing the visual style for AI image generation, including colors, lighting, effects, composition, and mood',
          },
        },
        required: ['name', 'description', 'prompt'],
      },
    }

    const userPrompt = `You are an expert visual style analyst for thumbnails. I am providing ${imagePayloads.length} thumbnail images. Your task is to analyze them together and extract the COMMON visual style across all of them.

Identify shared characteristics across these images:
- Color palette and color grading
- Lighting style (dramatic, soft, neon, natural)
- Composition techniques
- Typography/text treatment if visible (describe the styling, not the actual words)
- Special effects (blur, glow, grain, gradients, etc.)
- Overall mood and energy

Produce a SINGLE style that captures what these thumbnails have in common:
1. A catchy, memorable style name (2-4 words)
2. A brief description (1-2 sentences) of what makes this style distinctive
3. A detailed generation prompt (100-200 words) that would allow an AI to recreate this visual style for thumbnails

Keep the description concise. DO NOT mention "YouTube". Start the description with "This style is a" and then describe the style.

You MUST call the extract_style_info function with your analysis.`

    let raw
    try {
      raw = await callGeminiWithFunctionCalling(
        null,
        userPrompt,
        imagePayloads,
        toolDefinition,
        'extract_style_info',
        'gemini-2.5-flash'
      )
    } catch (error) {
      return aiServiceErrorResponse(error, 'Failed to extract style', {
        route: 'POST /api/styles/extract-from-youtube',
        userId: user.id,
      })
    }

    const result = (raw as { functionCallResult?: { name?: string; description?: string; prompt?: string } })
      .functionCallResult ?? {}

    return NextResponse.json({
      name: result.name ?? '',
      description: result.description ?? '',
      prompt: result.prompt ?? '',
      reference_images: referenceImages,
    })
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to extract style from YouTube', {
      route: 'POST /api/styles/extract-from-youtube',
    })
  }
}
