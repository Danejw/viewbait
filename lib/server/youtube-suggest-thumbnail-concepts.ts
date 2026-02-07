/**
 * Server-side helper: suggest 2–4 thumbnail concept prompts from video analytics.
 * Used by POST /api/youtube/videos/suggest-thumbnail-concepts.
 * One text-only Gemini call with structured JSON output.
 */

import { callGeminiTextStructuredOutput } from '@/lib/services/ai-core'
import type { YouTubeVideoAnalytics } from '@/lib/services/youtube-video-analyze'

export interface ThumbnailConcept {
  text: string
  styleHint?: string
}

const CONCEPTS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      description: '2–4 thumbnail concept prompts',
      items: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Short text suitable as main thumbnail text (title or title: subtext)',
          },
          styleHint: {
            type: 'string',
            description: 'Optional brief style hint (e.g. "reaction face", "split screen")',
          },
        },
        required: ['text'],
      },
      minItems: 2,
      maxItems: 4,
    },
  },
  required: ['concepts'],
}

/**
 * Build context block for the suggestion prompt from analytics.
 */
function buildContextBlock(analytics: YouTubeVideoAnalytics): string {
  const parts: string[] = []
  parts.push(`Summary: ${analytics.summary}`)
  if (analytics.topic?.trim()) parts.push(`Topic: ${analytics.topic}`)
  if (analytics.tone?.trim()) parts.push(`Tone: ${analytics.tone}`)
  if (analytics.content_type?.trim()) parts.push(`Content type: ${analytics.content_type}`)
  if (analytics.key_moments?.trim()) parts.push(`Key moments: ${analytics.key_moments}`)
  if (analytics.hooks?.trim()) parts.push(`Hooks: ${analytics.hooks}`)
  if (analytics.thumbnail_appeal_notes?.trim())
    parts.push(`Thumbnail appeal notes: ${analytics.thumbnail_appeal_notes}`)
  if (analytics.characters?.length) {
    const names = analytics.characters.map((c) => c.name).join(', ')
    parts.push(`Characters: ${names}`)
  }
  if (analytics.places?.length) {
    const names = analytics.places.map((p) => p.name).join(', ')
    parts.push(`Places: ${names}`)
  }
  return parts.join('\n')
}

/**
 * Suggest 2–4 thumbnail concept prompts from video analytics and title.
 * Returns concepts suitable for one-click pre-fill in the generator.
 */
export async function suggestThumbnailConceptsFromAnalysis(
  analytics: YouTubeVideoAnalytics,
  videoTitle: string
): Promise<ThumbnailConcept[]> {
  const systemPrompt = `You are an expert thumbnail strategist for YouTube creators. Your goal is to produce 2–4 short, click-worthy thumbnail concept prompts that align with the video and work as main thumbnail text (title or title: subtext). Each concept should be concise, varied (e.g. emotion-driven, curiosity, outcome, key moment), and suitable for direct use as the primary text on a thumbnail. No extra wording or explanations.`

  const contextBlock = buildContextBlock(analytics)
  const userPrompt = `Video title: ${videoTitle}

Video context:
${contextBlock}

Output 2–4 thumbnail concept prompts. Each "text" must be short (main title or "Main title: subtext"). Add an optional "styleHint" per concept (e.g. "reaction face", "before/after split", "key moment") to guide visual style. Variety is important.`

  const result = await callGeminiTextStructuredOutput(
    systemPrompt,
    userPrompt,
    CONCEPTS_RESPONSE_SCHEMA,
    'gemini-2.5-flash'
  )

  const raw = result.concepts
  if (!Array.isArray(raw)) return []

  const concepts: ThumbnailConcept[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const text = String((item as Record<string, unknown>).text ?? '').trim()
    if (!text) continue
    const styleHint =
      typeof (item as Record<string, unknown>).styleHint === 'string'
        ? (item as Record<string, unknown>).styleHint as string
        : undefined
    concepts.push(styleHint ? { text, styleHint } : { text })
  }

  return concepts.slice(0, 4)
}
