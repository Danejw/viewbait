/**
 * Suggest Thumbnail Concepts API Route
 *
 * Given video analytics (and title), returns 2–4 thumbnail concept prompts for one-click pre-fill.
 * Client must provide analytics (from cache or from a prior analyze call). Pro tier only.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import {
  validationErrorResponse,
  configErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { requireAuth } from '@/lib/server/utils/auth'
import { suggestThumbnailConceptsFromAnalysis } from '@/lib/server/youtube-suggest-thumbnail-concepts'
import type { YouTubeVideoAnalytics } from '@/lib/services/youtube-video-analyze'

export interface SuggestThumbnailConceptsRequest {
  videoId: string
  videoTitle: string
  /** Analytics from video analysis (client sends from cache or after calling analyze). */
  analytics: YouTubeVideoAnalytics
}

function isYouTubeVideoAnalytics(value: unknown): value is YouTubeVideoAnalytics {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return (
    typeof o.summary === 'string' &&
    typeof o.topic === 'string' &&
    typeof o.content_type === 'string'
  )
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tierName = await getTierNameForUser(supabase, user.id)
    if (tierName !== 'pro') {
      return NextResponse.json(
        {
          success: false,
          error: 'Suggest thumbnail concepts is available on the Pro plan.',
          code: 'TIER_REQUIRED',
        },
        { status: 403 }
      )
    }

    if (!process.env.GEMINI_API_KEY) {
      return configErrorResponse('AI service not configured')
    }

    const body: SuggestThumbnailConceptsRequest = await request.json()
    const videoId = typeof body.videoId === 'string' ? body.videoId.trim() : ''
    const videoTitle = typeof body.videoTitle === 'string' ? body.videoTitle.trim() : ''

    if (!videoId) {
      return validationErrorResponse('videoId is required')
    }
    if (!body.analytics || !isYouTubeVideoAnalytics(body.analytics)) {
      return validationErrorResponse('analytics is required and must match video analysis shape')
    }

    const concepts = await suggestThumbnailConceptsFromAnalysis(body.analytics, videoTitle || 'Untitled')

    return NextResponse.json({ concepts })
  } catch (error) {
    return handleApiError(
      error,
      'POST /api/youtube/videos/suggest-thumbnail-concepts',
      'suggest-thumbnail-concepts',
      undefined,
      'Failed to suggest thumbnail concepts'
    )
  }
}
