/**
 * Experiments API Route
 * 
 * Handles GET (list) and POST (create) operations for experiments.
 * All operations are server-side only for security.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

export interface ExperimentCreateRequest {
  video_id: string
  channel_id: string
  notes?: string
}

export interface ExperimentResponse {
  id: string
  user_id: string
  channel_id: string
  video_id: string
  status: 'draft' | 'ready_for_studio' | 'running' | 'needs_import' | 'completed'
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  variants?: Array<{
    id: string
    experiment_id: string
    label: 'A' | 'B' | 'C'
    title_text: string
    thumbnail_asset_url: string
    thumbnail_id: string | null
    created_at: string
  }>
  result?: {
    id: string
    experiment_id: string
    winner_variant_label: 'A' | 'B' | 'C'
    imported_at: string
    youtube_label: string | null
    watch_time_share_a: number | null
    watch_time_share_b: number | null
    watch_time_share_c: number | null
    created_at: string
  }
}

/**
 * GET /api/experiments
 * List experiments for the authenticated user
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const status = searchParams.get('status')
    const videoId = searchParams.get('video_id')

    // Build query
    let query = supabase
      .from('experiments')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    if (status) {
      query = query.eq('status', status)
    }

    if (videoId) {
      query = query.eq('video_id', videoId)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: experiments, count, error } = await query

    if (error) {
      logError(error, {
        route: 'GET /api/experiments',
        userId: user.id,
        operation: 'fetch-experiments',
      })
      return databaseErrorResponse('Failed to fetch experiments')
    }

    // Fetch variants and results for each experiment
    const experimentsWithRelations = await Promise.all(
      (experiments || []).map(async (experiment) => {
        // Fetch variants and result in parallel
        const [variantsResult, resultResult] = await Promise.all([
          supabase
            .from('experiment_variants')
            .select('*')
            .eq('experiment_id', experiment.id)
            .order('label', { ascending: true }),
          supabase
            .from('experiment_results')
            .select('*')
            .eq('experiment_id', experiment.id)
            .single()
        ])

        return {
          ...experiment,
          variants: variantsResult.data || [],
          result: resultResult.data || undefined,
        } as ExperimentResponse
      })
    )

    return NextResponse.json({
      experiments: experimentsWithRelations,
      count: count || 0,
    })
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'fetch-experiments', undefined, 'Failed to fetch experiments')
  }
}

/**
 * POST /api/experiments
 * Create a new experiment
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body: ExperimentCreateRequest = await request.json()
    
    // Validate required fields
    if (!body.video_id || !body.video_id.trim()) {
      return validationErrorResponse('video_id is required')
    }

    if (!body.channel_id || !body.channel_id.trim()) {
      return validationErrorResponse('channel_id is required')
    }

    // Create experiment record
    const { data: experiment, error: insertError } = await supabase
      .from('experiments')
      .insert({
        user_id: user.id,
        video_id: body.video_id.trim(),
        channel_id: body.channel_id.trim(),
        notes: body.notes?.trim() || null,
        status: 'draft',
      })
      .select()
      .single()

    if (insertError) {
      logError(insertError, {
        route: 'POST /api/experiments',
        userId: user.id,
        operation: 'create-experiment',
      })
      return databaseErrorResponse('Failed to create experiment')
    }

    return NextResponse.json(
      {
        experiment: {
          ...experiment,
          variants: [],
        } as ExperimentResponse,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'create-experiment', undefined, 'Failed to create experiment')
  }
}
