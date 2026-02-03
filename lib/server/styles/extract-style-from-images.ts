/**
 * Shared server logic: extract a common visual style from multiple image URLs.
 * Used by POST /api/styles/extract-from-youtube and the chat route (youtube_extract_style).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { callGeminiWithFunctionCalling } from '@/lib/services/ai-core'
import { fetchImageAsBase64 } from '@/lib/utils/ai-helpers'
import { SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS } from '@/lib/server/utils/url-refresh'
import { logError } from '@/lib/server/utils/logger'

export const MIN_IMAGES = 2
export const MAX_IMAGES = 10

export interface ExtractStyleFromImagesResult {
  name: string
  description: string
  prompt: string
  reference_images: string[]
}

const extractStyleToolDefinition = {
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

/**
 * Fetch images from URLs, upload to style-references, call Gemini to extract common style.
 * Caller must ensure tier/can_create_custom and GEMINI_API_KEY.
 */
export async function extractStyleFromImageUrls(
  supabase: SupabaseClient,
  userId: string,
  imageUrls: string[]
): Promise<ExtractStyleFromImagesResult> {
  if (imageUrls.length < MIN_IMAGES || imageUrls.length > MAX_IMAGES) {
    throw new Error(`Need between ${MIN_IMAGES} and ${MAX_IMAGES} images, got ${imageUrls.length}`)
  }

  const imagePayloads: Array<{ data: string; mimeType: string }> = []
  for (let i = 0; i < imageUrls.length; i++) {
    const payload = await fetchImageAsBase64(imageUrls[i])
    if (!payload) {
      throw new Error(`Failed to fetch image ${i + 1}. Check that the URL is accessible.`)
    }
    imagePayloads.push(payload)
  }

  const tempId = crypto.randomUUID()
  const referenceImages: string[] = []

  for (let i = 0; i < imagePayloads.length; i++) {
    const payload = imagePayloads[i]
    const ext = payload.mimeType === 'image/png' ? 'png' : 'jpg'
    const storagePath = `${userId}/${tempId}-${i}.${ext}`

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
        module: 'extract-style-from-images',
        userId,
        operation: 'upload-thumbnail',
        index: i,
      })
      throw new Error(`Failed to save image ${i + 1}`)
    }

    const { data: urlData } = await supabase.storage
      .from('style-references')
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS)

    if (urlData?.signedUrl) {
      referenceImages.push(urlData.signedUrl)
    } else {
      referenceImages.push(storagePath)
    }
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

  const raw = await callGeminiWithFunctionCalling(
    null,
    userPrompt,
    imagePayloads,
    extractStyleToolDefinition,
    'extract_style_info',
    'gemini-2.5-flash'
  )

  const result = (raw as { functionCallResult?: { name?: string; description?: string; prompt?: string } })
    .functionCallResult ?? {}

  return {
    name: result.name ?? 'Extracted Style',
    description: result.description ?? '',
    prompt: result.prompt ?? '',
    reference_images: referenceImages,
  }
}
