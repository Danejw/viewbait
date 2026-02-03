/**
 * YouTube Video Analysis API Route
 *
 * Uses Gemini video understanding to analyze a YouTube video by URL.
 * Returns structured analytics based on a rubric (summary, topic, tone, key moments, etc.)
 * for display in the YouTube video analytics modal.
 */

import { NextResponse } from 'next/server'
import { callGeminiWithYouTubeVideoAndStructuredOutput } from '@/lib/services/ai-core'
import { requireAuth } from '@/lib/server/utils/auth'
import { createClient } from '@/lib/supabase/server'
import {
  validationErrorResponse,
  configErrorResponse,
  aiServiceErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { logError } from '@/lib/server/utils/logger'

const YOUTUBE_WATCH_BASE = 'https://www.youtube.com/watch?v='

export interface AnalyzeYouTubeVideoRequest {
  videoId: string
}

export interface VideoAnalyticsCharacterScene {
  part: string
  description: string
}

export interface VideoAnalyticsCharacter {
  name: string
  scenes: VideoAnalyticsCharacterScene[]
}

export interface VideoAnalyticsPlaceScene {
  part: string
  description: string
}

export interface VideoAnalyticsPlace {
  name: string
  scenes: VideoAnalyticsPlaceScene[]
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
  characters: VideoAnalyticsCharacter[]
  places: VideoAnalyticsPlace[]
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

    const systemPrompt = `You are an expert video analyst for content creators. Analyze the provided YouTube video and fill out the rubric below. Focus on what matters for thumbnail and title optimization, audience engagement, and content strategy. Also identify main characters or people in the video and where they appear, and identify distinct places or locations the video goes through (e.g. a kitchen, a studio, outdoors, a specific city). Be concise but informative. Use clear, short phrases or bullet points where appropriate.`

    const userPrompt = `Analyze this YouTube video and extract the following attributes. Respond with a JSON object that matches the schema provided (no other text).

Rubric:
1. summary: 2-4 sentence overview of what the video is about.
2. topic: Main topic or category (e.g. tutorial, vlog, gaming, review).
3. tone: Overall tone (e.g. educational, entertaining, dramatic, casual).
4. key_moments: Notable moments or segments that could inform thumbnails or titles (brief, with rough timestamps if useful).
5. hooks: What grabs attention in the first 30 seconds or in the content (for thumbnail/title ideas).
6. duration_estimate: Approximate length or pacing note (e.g. "short and punchy", "long-form deep dive").
7. thumbnail_appeal_notes: How the current or suggested thumbnail could align with the content; what visuals would work.
8. content_type: One or two words (e.g. Tutorial, Vlog, Review, Comedy, How-to).
9. characters: List the main characters or people in the video. For each, give a short name or description and a list of scenes: each scene has a part (timestamp or segment, e.g. 0:30–1:15 or Intro) and a one-sentence description of what that person did in that part of the video.
10. places: List the distinct places or locations the video goes through (e.g. kitchen, studio, park, office). For each place, give a short name and a list of scenes: each scene has a part (timestamp or segment) and a one-sentence description of what that place is or what happens there in the video.`

    const videoAnalyticsResponseSchema: Record<string, unknown> = {
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
        characters: {
          type: 'array',
          description: 'Main characters or people in the video with scenes where they appear',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Character or person name, or short description if unnamed' },
              scenes: {
                type: 'array',
                description: 'Parts of the video where this person appears',
                items: {
                  type: 'object',
                  properties: {
                    part: { type: 'string', description: 'Timestamp or segment (e.g. 0:30–1:15, Intro)' },
                    description: { type: 'string', description: 'One sentence: what they did in this scene' },
                  },
                  required: ['part', 'description'],
                },
              },
            },
            required: ['name', 'scenes'],
          },
        },
        places: {
          type: 'array',
          description: 'Distinct places or locations the video goes through, with scenes where each appears',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Place or location name (e.g. kitchen, studio, park)' },
              scenes: {
                type: 'array',
                description: 'Parts of the video where this place appears',
                items: {
                  type: 'object',
                  properties: {
                    part: { type: 'string', description: 'Timestamp or segment (e.g. 0:30–1:15, Intro)' },
                    description: {
                      type: 'string',
                      description: 'One sentence describing the place or what happens there in this scene',
                    },
                  },
                  required: ['part', 'description'],
                },
              },
            },
            required: ['name', 'scenes'],
          },
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
        'characters',
        'places',
      ],
    }

    let analytics: Record<string, unknown>
    try {
      analytics = await callGeminiWithYouTubeVideoAndStructuredOutput(
        systemPrompt,
        userPrompt,
        youtubeUrl,
        videoAnalyticsResponseSchema,
        'gemini-2.5-flash'
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (
        message.includes('No text in Gemini') ||
        message.includes('invalid JSON') ||
        message.includes('structured output')
      ) {
        logError(error, {
          route: 'POST /api/youtube/videos/analyze',
          operation: 'analysis-no-structured-response',
        })
        return NextResponse.json(
          {
            error:
              'Video analysis could not be completed. The model did not return valid structured data. Try again or a different video.',
            code: 'ANALYSIS_NO_STRUCTURED_RESPONSE',
          },
          { status: 503 }
        )
      }
      return aiServiceErrorResponse(
        error,
        'Failed to analyze video',
        { route: 'POST /api/youtube/videos/analyze' }
      )
    }

    function normalizeCharacters(raw: unknown): VideoAnalyticsCharacter[] {
      if (!Array.isArray(raw)) return []
      const out: VideoAnalyticsCharacter[] = []
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const name = String((item as Record<string, unknown>).name ?? '').trim()
        const scenesRaw = (item as Record<string, unknown>).scenes
        if (!name) continue
        const scenes: VideoAnalyticsCharacterScene[] = []
        if (Array.isArray(scenesRaw)) {
          for (const s of scenesRaw) {
            if (!s || typeof s !== 'object') continue
            const part = String((s as Record<string, unknown>).part ?? '').trim()
            const description = String((s as Record<string, unknown>).description ?? '').trim()
            if (part || description) scenes.push({ part: part || '—', description: description || '—' })
          }
        }
        out.push({ name, scenes })
      }
      return out
    }

    function normalizePlaces(raw: unknown): VideoAnalyticsPlace[] {
      if (!Array.isArray(raw)) return []
      const out: VideoAnalyticsPlace[] = []
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const name = String((item as Record<string, unknown>).name ?? '').trim()
        const scenesRaw = (item as Record<string, unknown>).scenes
        if (!name) continue
        const scenes: VideoAnalyticsPlaceScene[] = []
        if (Array.isArray(scenesRaw)) {
          for (const s of scenesRaw) {
            if (!s || typeof s !== 'object') continue
            const part = String((s as Record<string, unknown>).part ?? '').trim()
            const description = String((s as Record<string, unknown>).description ?? '').trim()
            if (part || description) scenes.push({ part: part || '—', description: description || '—' })
          }
        }
        out.push({ name, scenes })
      }
      return out
    }

    const normalized: YouTubeVideoAnalytics = {
      summary: String(analytics.summary ?? '').trim() || '—',
      topic: String(analytics.topic ?? '').trim() || '—',
      tone: String(analytics.tone ?? '').trim() || '—',
      key_moments: String(analytics.key_moments ?? '').trim() || '—',
      hooks: String(analytics.hooks ?? '').trim() || '—',
      duration_estimate: String(analytics.duration_estimate ?? '').trim() || '—',
      thumbnail_appeal_notes: String(analytics.thumbnail_appeal_notes ?? '').trim() || '—',
      content_type: String(analytics.content_type ?? '').trim() || '—',
      characters: normalizeCharacters(analytics.characters),
      places: normalizePlaces(analytics.places),
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
