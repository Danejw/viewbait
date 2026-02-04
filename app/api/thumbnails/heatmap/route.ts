/**
 * Thumbnail Attention Heatmap API Route
 *
 * Accepts a thumbnail (by imageUrl or thumbnailId), calls Gemini image model
 * to generate a visual attention heatmap, and returns the heatmap image.
 * Gated to Advanced and Pro subscription tiers.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { callGeminiImageEdit } from '@/lib/services/ai-core'
import { fetchImageAsBase64 } from '@/lib/utils/ai-helpers'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { refreshSignedUrl } from '@/lib/server/utils/url-refresh'
import {
  validationErrorResponse,
  configErrorResponse,
  aiServiceErrorResponse,
  notFoundResponse,
  forbiddenResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

const HEATMAP_PROMPT = `Generate a single image that is a visual attention heatmap for this thumbnail image.

The heatmap must show where viewers are most likely to look first and most (e.g. faces, text, high-contrast areas). Use the same dimensions and aspect ratio as the input image. The output image must have exactly the same pixel dimensions as the input so it can be overlaid 1:1.

Use warm colors (red, orange, yellow) for high-attention areas and cool colors (blue, green) for low-attention areas. Make the heatmap semi-transparent so it can be overlaid on the original thumbnail. Output only the heatmap image—no text, labels, or borders.`

export interface HeatmapRequest {
  /** Client-provided base64 image (exact image the user sees). When set, used for Gemini; optional thumbnailId for ownership check. */
  imageData?: string
  mimeType?: string
  imageUrl?: string
  thumbnailId?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tier = await getTierNameForUser(supabase, user.id)
    if (tier !== 'advanced' && tier !== 'pro') {
      return forbiddenResponse(
        'Advanced or Pro subscription required to use attention heatmaps.'
      )
    }

    const body: HeatmapRequest = await request.json()

    const hasClientImage =
      typeof body.imageData === 'string' &&
      body.imageData.length > 0 &&
      typeof body.mimeType === 'string' &&
      body.mimeType.trim().length > 0
    const hasImageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim().length > 0
    const hasThumbnailId = typeof body.thumbnailId === 'string' && body.thumbnailId.trim().length > 0

    if (!hasClientImage && !hasImageUrl && !hasThumbnailId) {
      return validationErrorResponse(
        'At least one of (imageData + mimeType), imageUrl, or thumbnailId is required'
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return configErrorResponse('AI service not configured')
    }

    let imageData: { data: string; mimeType: string } | null = null

    if (hasClientImage) {
      if (hasThumbnailId) {
        const { data: thumbnail, error: thumbError } = await supabase
          .from('thumbnails')
          .select('id')
          .eq('id', body.thumbnailId!)
          .eq('user_id', user.id)
          .single()

        if (thumbError || !thumbnail) {
          return notFoundResponse('Thumbnail not found or access denied')
        }
      }
      imageData = {
        data: body.imageData!,
        mimeType: body.mimeType!.trim(),
      }
    } else {
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
    }

    if (!imageData) {
      return aiServiceErrorResponse(
        new Error('Failed to fetch or process image'),
        'Failed to fetch or process image',
        { route: 'POST /api/thumbnails/heatmap', userId: user.id }
      )
    }

    let result
    try {
      result = await callGeminiImageEdit(
        HEATMAP_PROMPT,
        imageData,
        undefined,
        'gemini-3-pro-image-preview'
      )
    } catch (error) {
      return aiServiceErrorResponse(
        error,
        'Failed to generate heatmap',
        {
          route: 'POST /api/thumbnails/heatmap',
          userId: user.id,
        }
      )
    }

    if (!result?.imageData) {
      return aiServiceErrorResponse(
        new Error('No image data in heatmap response'),
        'Failed to generate heatmap',
        { route: 'POST /api/thumbnails/heatmap', userId: user.id }
      )
    }

    return NextResponse.json({
      imageData: result.imageData,
      mimeType: result.mimeType || 'image/png',
    })
  } catch (error) {
    return handleApiError(
      error,
      'POST /api/thumbnails/heatmap',
      'thumbnail-heatmap',
      undefined,
      'Failed to generate heatmap'
    )
  }
}
