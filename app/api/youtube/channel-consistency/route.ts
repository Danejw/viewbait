/**
 * YouTube Channel Consistency API Route
 *
 * Analyzes how consistent a video's thumbnail is with the rest of the channel's thumbnails.
 * Requires client to send otherThumbnailUrls (MVP: no server-side channel fetch).
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
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { isYouTubeConnected } from '@/lib/services/youtube'

/** Maximum number of reference channel thumbnails to send to the model. */
const CHANNEL_CONSISTENCY_MAX_REF_IMAGES = 10

export interface ChannelConsistencyRequest {
  videoId: string
  thumbnailUrl?: string
  otherThumbnailUrls: string[]
}

export interface ChannelConsistencyResponse {
  score: number
  cues: string[]
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const connected = await isYouTubeConnected(user.id)
    if (!connected) {
      return NextResponse.json(
        { error: 'YouTube not connected', code: 'NOT_CONNECTED' },
        { status: 404 }
      )
    }

    const body: ChannelConsistencyRequest = await request.json()
    const { videoId, thumbnailUrl, otherThumbnailUrls } = body

    if (!videoId || typeof videoId !== 'string') {
      return validationErrorResponse('videoId is required')
    }

    const targetUrl = thumbnailUrl ?? null
    if (!targetUrl || typeof targetUrl !== 'string') {
      return validationErrorResponse('thumbnailUrl is required')
    }

    if (!Array.isArray(otherThumbnailUrls) || otherThumbnailUrls.length === 0) {
      return validationErrorResponse(
        'Not enough channel thumbnails to compare. Please try again from the YouTube tab.'
      )
    }

    const refUrls = otherThumbnailUrls.slice(0, CHANNEL_CONSISTENCY_MAX_REF_IMAGES)

    if (!process.env.GEMINI_API_KEY) {
      return configErrorResponse('AI service not configured')
    }

    const targetImage = await fetchImageAsBase64(targetUrl)
    if (!targetImage) {
      return aiServiceErrorResponse(
        new Error('Failed to fetch target thumbnail'),
        'Failed to fetch target thumbnail',
        { route: 'POST /api/youtube/channel-consistency', userId: user.id }
      )
    }

    const refImages: Array<{ data: string; mimeType: string }> = []
    for (const url of refUrls) {
      const img = await fetchImageAsBase64(url)
      if (img) refImages.push(img)
    }

    if (refImages.length === 0) {
      return validationErrorResponse(
        'Could not load any channel thumbnails for comparison. Please try again.'
      )
    }

    const imageData = [targetImage, ...refImages]
    const numRefs = imageData.length - 1

    const userPrompt = `You are an expert at evaluating thumbnail consistency for YouTube channels.

The first image is the video thumbnail to score. The following ${numRefs} images are other thumbnails from the same channel.

Compare the first thumbnail to the channel thumbnails. Rate how consistent it is in terms of:
- Color palette and grading
- Layout and composition style
- Typography or text treatment (if visible)
- Overall mood and energy

You MUST call the channel_consistency_result function with:
1. score: A number from 1 to 5, where 1 = very inconsistent, 5 = very consistent with the channel.
2. cues: An array of 1 to 2 short phrases (e.g. "Palette similar to channel", "Layout differs from recent thumbnails") that explain the score.`

    const toolDefinition = {
      name: 'channel_consistency_result',
      description: 'Report the channel consistency score and short cues',
      parameters: {
        type: 'object',
        properties: {
          score: {
            type: 'number',
            description: 'Consistency score from 1 to 5 (1 = very inconsistent, 5 = very consistent)',
          },
          cues: {
            type: 'array',
            items: { type: 'string' },
            description: '1 to 2 short phrases explaining the score',
          },
        },
        required: ['score', 'cues'],
      },
    }

    let raw
    try {
      raw = await callGeminiWithFunctionCalling(
        null,
        userPrompt,
        imageData,
        toolDefinition,
        'channel_consistency_result',
        'gemini-2.5-flash',
        false
      )
    } catch (error) {
      return aiServiceErrorResponse(
        error,
        'Failed to analyze channel consistency',
        { route: 'POST /api/youtube/channel-consistency', userId: user.id }
      )
    }

    const result = (raw as { functionCallResult?: { score?: number; cues?: string[] } })
      .functionCallResult ?? {}
    const score = typeof result.score === 'number'
      ? Math.min(5, Math.max(1, Math.round(result.score)))
      : 3
    const cues = Array.isArray(result.cues)
      ? result.cues.filter((c): c is string => typeof c === 'string').slice(0, 2)
      : []

    return NextResponse.json({
      score,
      cues,
    } as ChannelConsistencyResponse)
  } catch (error) {
    return handleApiError(
      error,
      'POST /api/youtube/channel-consistency',
      'channel-consistency',
      undefined,
      'Failed to check channel consistency'
    )
  }
}
