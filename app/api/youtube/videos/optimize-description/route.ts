import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { callGeminiTextGeneration } from '@/lib/services/ai-core'
import { validationErrorResponse, configErrorResponse, aiServiceErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import type { YouTubeVideoAnalytics } from '@/app/api/youtube/videos/analyze/route'

interface OptimizeDescriptionRequest {
  videoTitle: string
  analytics: YouTubeVideoAnalytics
  channelTitle?: string
  channelDescription?: string
  channelSocialLinks?: string[]
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tierName = await getTierNameForUser(supabase, user.id)
    if (tierName !== 'pro') {
      return NextResponse.json({ success: false, error: 'YouTube integration is available on the Pro plan.', code: 'TIER_REQUIRED' }, { status: 403 })
    }

    const body: OptimizeDescriptionRequest = await request.json()
    const videoTitle = typeof body.videoTitle === 'string' ? body.videoTitle.trim() : ''

    if (!videoTitle) return validationErrorResponse('videoTitle is required')
    if (!body.analytics || typeof body.analytics !== 'object') {
      return validationErrorResponse('analytics is required')
    }

    if (!process.env.GEMINI_API_KEY) return configErrorResponse('AI service not configured')

    const channelSocialLinks = Array.isArray(body.channelSocialLinks)
      ? body.channelSocialLinks.map((l) => String(l).trim()).filter(Boolean).slice(0, 8)
      : []

    const systemPrompt = `You are an expert YouTube SEO + AIEO optimizer. Generate a complete YouTube description that is highly readable, aligned with channel voice, and optimized for search and AI summaries.

Requirements:
- Output plain text only (no markdown code blocks).
- Keep total length between 900 and 2200 characters.
- Include sections in this exact order with these headers:
  1) Overview:
  2) Links:
  3) Chapters:
- Overview: one concise paragraph in the channel's style, naturally using important keywords from the video topic.
- Links: include likely useful resources first (if relevant) and then the channel's own social links.
- Chapters: 6-12 entries. Format each as "MM:SS - <short phrase>".
- Each chapter description must be less than one sentence (short phrase only).
- Do not fabricate brand partnerships, prices, or unverifiable claims.
- Keep language clear and creator-friendly.`

    const userPrompt = `Video title: ${videoTitle}
Channel title: ${body.channelTitle?.trim() || 'Unknown channel'}
Channel style/context: ${body.channelDescription?.trim() || 'No channel description provided.'}
Channel social links (must include under Links): ${channelSocialLinks.join(', ') || 'None provided'}

Video understanding data:
- Summary: ${body.analytics.summary}
- Topic: ${body.analytics.topic}
- Tone: ${body.analytics.tone}
- Key moments: ${body.analytics.key_moments}
- Hooks: ${body.analytics.hooks}
- Duration estimate: ${body.analytics.duration_estimate}
- Content type: ${body.analytics.content_type}

Create the final YouTube description now.`

    let description = ''
    try {
      description = await callGeminiTextGeneration(systemPrompt, userPrompt, 'gemini-2.5-flash')
    } catch (error) {
      return aiServiceErrorResponse(error, 'Failed to optimize YouTube description', {
        route: 'POST /api/youtube/videos/optimize-description',
        userId: user.id,
      })
    }

    return NextResponse.json({ description: description.trim() })
  } catch (error) {
    return handleApiError(error, 'POST /api/youtube/videos/optimize-description', 'optimize-youtube-description', undefined, 'Failed to optimize YouTube description')
  }
}
