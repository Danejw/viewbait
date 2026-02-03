/**
 * Extract Style from YouTube Thumbnails API Route
 *
 * Accepts multiple YouTube thumbnail URLs, fetches them, uploads to storage,
 * and calls Gemini to extract a common visual style across all images.
 * Returns name, description, prompt, and reference_images (storage URLs).
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
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
import {
  extractStyleFromImageUrls,
  MIN_IMAGES,
  MAX_IMAGES,
} from '@/lib/server/styles/extract-style-from-images'

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

    const result = await extractStyleFromImageUrls(supabase, user.id, imageUrls)

    return NextResponse.json({
      name: result.name,
      description: result.description,
      prompt: result.prompt,
      reference_images: result.reference_images,
    })
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    if (error instanceof Error) {
      if (error.message.startsWith('Failed to fetch image')) {
        return validationErrorResponse(error.message)
      }
      if (error.message.startsWith('Failed to save image')) {
        return NextResponse.json(
          { error: error.message, code: 'UPLOAD_ERROR' },
          { status: 500 }
        )
      }
    }
    logError(error as Error, {
      route: 'POST /api/styles/extract-from-youtube',
    })
    return serverErrorResponse(error as Error, 'Failed to extract style from YouTube', {
      route: 'POST /api/styles/extract-from-youtube',
    })
  }
}
