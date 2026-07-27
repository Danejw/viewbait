import type { SupabaseClient } from '@supabase/supabase-js'
import { callGeminiWithFunctionCalling } from '@/lib/services/ai-core'
import { fetchImageAsBase64 } from '@/lib/utils/ai-helpers'
import { refreshSignedUrl } from '@/lib/server/utils/url-refresh'

interface ComparisonThumbnailLabel {
  id: string
  title: string
}

export interface ThumbnailComparisonCandidate {
  thumbnail_id: string
  predicted_click_appeal: number
  clarity: number
  visual_hierarchy: number
  emotional_impact: number
  mobile_readability: number
  strengths: string[]
  risks: string[]
}

export interface ThumbnailComparison {
  winner_thumbnail_id: string
  winner_rationale: string
  candidates: ThumbnailComparisonCandidate[]
  recommended_next_steps: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asString).filter(Boolean).slice(0, 8)
    : []
}

function score(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

export function buildThumbnailComparisonPrompt(
  thumbnails: ComparisonThumbnailLabel[],
  objective?: string,
): string {
  const labels = thumbnails
    .map(
      (thumbnail, index) =>
        `Image ${index + 1} = thumbnail ${thumbnail.id} (${JSON.stringify(thumbnail.title)})`,
    )
    .join('\n')

  return `Compare these thumbnail candidates in the exact image order below:
${labels}

Objective: ${objective?.trim() || 'Choose the thumbnail most likely to earn a click while accurately communicating its subject.'}

Evaluate each image independently at full size and as a small mobile thumbnail. Score click appeal, clarity, visual hierarchy, emotional impact, and mobile readability from 0 to 100. Pick exactly one winner from the supplied thumbnail ids. Return concise evidence, risks, and practical next steps. Do not invent performance data or claim the scores are measured CTR.`
}

export function normalizeThumbnailComparison(
  requestedIds: string[],
  value: unknown,
): ThumbnailComparison {
  const record = asRecord(value)
  const winnerId = asString(record.winner_thumbnail_id)
  if (!requestedIds.includes(winnerId)) {
    throw new Error('Comparison returned an unknown thumbnail winner.')
  }

  const rawCandidates = Array.isArray(record.candidates) ? record.candidates : []
  const candidateMap = new Map<string, ThumbnailComparisonCandidate>()

  for (const rawCandidate of rawCandidates) {
    const candidate = asRecord(rawCandidate)
    const thumbnailId = asString(candidate.thumbnail_id)
    if (!requestedIds.includes(thumbnailId) || candidateMap.has(thumbnailId)) continue

    candidateMap.set(thumbnailId, {
      thumbnail_id: thumbnailId,
      predicted_click_appeal: score(candidate.predicted_click_appeal),
      clarity: score(candidate.clarity),
      visual_hierarchy: score(candidate.visual_hierarchy),
      emotional_impact: score(candidate.emotional_impact),
      mobile_readability: score(candidate.mobile_readability),
      strengths: asStringArray(candidate.strengths),
      risks: asStringArray(candidate.risks),
    })
  }

  const candidates = requestedIds.map((thumbnailId) => candidateMap.get(thumbnailId))
  if (candidates.some((candidate) => !candidate)) {
    throw new Error('Comparison did not evaluate every requested thumbnail.')
  }

  const winnerRationale = asString(record.winner_rationale)
  if (!winnerRationale) {
    throw new Error('Comparison did not explain the selected winner.')
  }

  return {
    winner_thumbnail_id: winnerId,
    winner_rationale: winnerRationale,
    candidates: candidates as ThumbnailComparisonCandidate[],
    recommended_next_steps: asStringArray(record.recommended_next_steps),
  }
}

const compareToolDefinition = {
  name: 'compare_viewbait_thumbnails',
  description: 'Return a structured creative comparison of supplied ViewBAIT thumbnails.',
  parameters: {
    type: 'object',
    properties: {
      winner_thumbnail_id: { type: 'string' },
      winner_rationale: { type: 'string' },
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            thumbnail_id: { type: 'string' },
            predicted_click_appeal: { type: 'number' },
            clarity: { type: 'number' },
            visual_hierarchy: { type: 'number' },
            emotional_impact: { type: 'number' },
            mobile_readability: { type: 'number' },
            strengths: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } },
          },
          required: [
            'thumbnail_id',
            'predicted_click_appeal',
            'clarity',
            'visual_hierarchy',
            'emotional_impact',
            'mobile_readability',
            'strengths',
            'risks',
          ],
        },
      },
      recommended_next_steps: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'winner_thumbnail_id',
      'winner_rationale',
      'candidates',
      'recommended_next_steps',
    ],
  },
}

export async function compareThumbnails(
  supabase: SupabaseClient,
  userId: string,
  thumbnailIds: string[],
  objective?: string,
): Promise<ThumbnailComparison> {
  const uniqueIds = [...new Set(thumbnailIds)]
  if (uniqueIds.length !== thumbnailIds.length) {
    throw new Error('Each thumbnail id must be unique.')
  }

  const { data, error } = await supabase
    .from('thumbnails')
    .select('id,title,image_url')
    .eq('user_id', userId)
    .in('id', uniqueIds)

  if (error) throw error
  const rows = (data ?? []) as Array<{ id: string; title: string; image_url: string }>
  const rowById = new Map(rows.map((row) => [row.id, row]))
  if (uniqueIds.some((id) => !rowById.has(id))) {
    throw new Error('One or more thumbnails were not found or are not owned by this account.')
  }

  const orderedRows = uniqueIds.map((id) => rowById.get(id)!)
  const images = await Promise.all(
    orderedRows.map(async (thumbnail) => {
      const refreshedUrl = await refreshSignedUrl(
        supabase,
        'thumbnails',
        thumbnail.image_url,
        `${userId}/${thumbnail.id}/thumbnail.png`,
      )
      const image = await fetchImageAsBase64(refreshedUrl)
      if (!image) throw new Error(`Could not load thumbnail ${thumbnail.id} for comparison.`)
      return image
    }),
  )

  const result = await callGeminiWithFunctionCalling(
    'You are a rigorous thumbnail creative director. Assess only visible creative qualities. Never present predicted scores as observed analytics.',
    buildThumbnailComparisonPrompt(orderedRows, objective),
    images,
    compareToolDefinition,
    compareToolDefinition.name,
    'gemini-2.5-flash',
    false,
  )

  const functionResult =
    'functionCallResult' in result ? result.functionCallResult : undefined
  return normalizeThumbnailComparison(uniqueIds, functionResult)
}
