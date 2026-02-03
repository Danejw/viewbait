/**
 * YouTube Video Analysis API Route
 *
 * Uses Gemini video understanding to analyze a YouTube video by URL.
 * Returns structured analytics based on a rubric (summary, topic, tone, key moments, etc.)
 * for display in the YouTube video analytics modal.
 */

import { NextResponse } from 'next/server'
import { callGeminiWithYouTubeVideoAndFunctionCalling } from '@/lib/services/ai-core'
import { requireAuth } from '@/lib/server/utils/auth'
import { createClient } from '@/lib/supabase/server'
import {
  validationErrorResponse,
  configErrorResponse,
  aiServiceErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'

const YOUTUBE_WATCH_BASE = 'https://www.youtube.com/watch?v='

export interface AnalyzeYouTubeVideoRequest {
  videoId: string
}

export interface YouTubeVideoAnalytics {
  summary: string
  topic: string
  tone: string
  key_moments: string
  hooks: string
  duration_estimate: string
  thumbnail_appeal_notes: string
  content_type: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    await requireAuth(supabase)

    const body: AnalyzeYouTubeVideoRequest = await request.json()
    const videoId = typeof body.videoId === 'string' ? body.videoId.trim() : ''

    if (!videoId) {
      return validationErrorResponse('videoId is required')
    }

    if (!process.env.GEMINI_API_KEY) {
      return configErrorResponse('AI service not configured')
    }

    const youtubeUrl = `${YOUTUBE_WATCH_BASE}${videoId}`

    const systemPrompt = `You are an expert video analyst for content creators. Analyze the provided YouTube video and fill out the rubric below. Focus on what matters for thumbnail and title optimization, audience engagement, and content strategy. Be concise but informative. Use clear, short phrases or bullet points where appropriate.`

    const userPrompt = `Analyze this YouTube video and extract the following attributes. You MUST call the video_analytics_rubric function with your analysis.

Rubric:
1. summary: 2-4 sentence overview of what the video is about.
2. topic: Main topic or category (e.g. tutorial, vlog, gaming, review).
3. tone: Overall tone (e.g. educational, entertaining, dramatic, casual).
4. key_moments: Notable moments or segments that could inform thumbnails or titles (brief, with rough timestamps if useful).
5. hooks: What grabs attention in the first 30 seconds or in the content (for thumbnail/title ideas).
6. duration_estimate: Approximate length or pacing note (e.g. "short and punchy", "long-form deep dive").
7. thumbnail_appeal_notes: How the current or suggested thumbnail could align with the content; what visuals would work.
8. content_type: One or two words (e.g. Tutorial, Vlog, Review, Comedy, How-to).`

    const toolDefinition = {
      name: 'video_analytics_rubric',
      description: 'Structured video analytics for content creators',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: '2-4 sentence overview of the video content',
          },
          topic: {
            type: 'string',
            description: 'Main topic or category',
          },
          tone: {
            type: 'string',
            description: 'Overall tone of the video',
          },
          key_moments: {
            type: 'string',
            description: 'Notable moments or segments, with timestamps if useful',
          },
          hooks: {
            type: 'string',
            description: 'What grabs attention early or in the content',
          },
          duration_estimate: {
            type: 'string',
            description: 'Length or pacing note',
          },
          thumbnail_appeal_notes: {
            type: 'string',
            description: 'Notes on thumbnail alignment and visual suggestions',
          },
          content_type: {
            type: 'string',
            description: 'Content type (e.g. Tutorial, Vlog, Review)',
          },
        },
        required: [
          'summary',
          'topic',
          'tone',
          'key_moments',
          'hooks',
          'duration_estimate',
          'thumbnail_appeal_notes',
          'content_type',
        ],
      },
    }

    let result
    try {
      result = await callGeminiWithYouTubeVideoAndFunctionCalling(
        systemPrompt,
        userPrompt,
        youtubeUrl,
        toolDefinition,
        'video_analytics_rubric',
        'gemini-2.5-flash'
      )
    } catch (error) {
      return aiServiceErrorResponse(
        error,
        'Failed to analyze video',
        { route: 'POST /api/youtube/videos/analyze' }
      )
    }

    const analytics = (result as { functionCallResult?: YouTubeVideoAnalytics }).functionCallResult ?? {}
    const normalized: YouTubeVideoAnalytics = {
      summary: String(analytics.summary ?? '').trim() || '—',
      topic: String(analytics.topic ?? '').trim() || '—',
      tone: String(analytics.tone ?? '').trim() || '—',
      key_moments: String(analytics.key_moments ?? '').trim() || '—',
      hooks: String(analytics.hooks ?? '').trim() || '—',
      duration_estimate: String(analytics.duration_estimate ?? '').trim() || '—',
      thumbnail_appeal_notes: String(analytics.thumbnail_appeal_notes ?? '').trim() || '—',
      content_type: String(analytics.content_type ?? '').trim() || '—',
    }

    return NextResponse.json({ analytics: normalized })
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to analyze video', {
      route: 'POST /api/youtube/videos/analyze',
    })
  }
}
