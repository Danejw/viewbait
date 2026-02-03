/**
 * Experiment Actions API Route
 * 
 * Handles POST operations for experiment actions:
 * - mark_started: Set started_at timestamp, update status to 'running'
 * - import_result: Import winner from YouTube Studio
 * - update_status: Manual status update
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { ExperimentResponse } from '../route'

export interface MarkStartedRequest {
  action: 'mark_started'
}

export interface ImportResultRequest {
  action: 'import_result'
  winner_variant_label: 'A' | 'B' | 'C'
  youtube_label?: string
  watch_time_share_a?: number
  watch_time_share_b?: number
  watch_time_share_c?: number
}

export interface UpdateStatusRequest {
  action: 'update_status'
  status: 'draft' | 'ready_for_studio' | 'running' | 'needs_import' | 'completed'
}

export type ExperimentActionRequest = MarkStartedRequest | ImportResultRequest | UpdateStatusRequest

/**
 * POST /api/experiments/[id]/actions
 * Perform an action on an experiment
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Verify experiment exists and belongs to user
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (expError || !experiment) {
      if (expError?.code === 'PGRST116') {
        return notFoundResponse('Experiment not found')
      }
      logError(expError, {
        route: 'POST /api/experiments/[id]/actions',
        userId: user.id,
        experimentId: id,
        operation: 'fetch-experiment',
      })
      return databaseErrorResponse('Failed to fetch experiment')
    }

    // Parse request body
    const body: ExperimentActionRequest = await request.json()

    if (!body.action) {
      return validationErrorResponse('action is required')
    }

    // Handle different actions
    switch (body.action) {
      case 'mark_started': {
        // Set started_at timestamp and update status to 'running'
        const { data: updatedExperiment, error: updateError } = await supabase
          .from('experiments')
          .update({
            started_at: new Date().toISOString(),
            status: 'running',
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (updateError) {
          logError(updateError, {
            route: 'POST /api/experiments/[id]/actions',
            userId: user.id,
            experimentId: id,
            action: 'mark_started',
            operation: 'update-experiment',
          })
          return databaseErrorResponse('Failed to mark experiment as started')
        }

        logInfo('Experiment marked as started', {
          route: 'POST /api/experiments/[id]/actions',
          userId: user.id,
          experimentId: id,
        })

        // Fetch variants and result
        const { data: variants } = await supabase
          .from('experiment_variants')
          .select('*')
          .eq('experiment_id', id)
          .order('label', { ascending: true })

        const { data: result } = await supabase
          .from('experiment_results')
          .select('*')
          .eq('experiment_id', id)
          .single()

        const experimentResponse: ExperimentResponse = {
          ...updatedExperiment,
          variants: variants || [],
          result: result || undefined,
        }

        return NextResponse.json({ experiment: experimentResponse })
      }

      case 'import_result': {
        const importBody = body as ImportResultRequest

        // Validate winner variant label
        if (!['A', 'B', 'C'].includes(importBody.winner_variant_label)) {
          return validationErrorResponse('winner_variant_label must be A, B, or C')
        }

        // Validate watch time shares if provided (should sum to ~100)
        if (
          importBody.watch_time_share_a !== undefined ||
          importBody.watch_time_share_b !== undefined ||
          importBody.watch_time_share_c !== undefined
        ) {
          const shares = [
            importBody.watch_time_share_a ?? 0,
            importBody.watch_time_share_b ?? 0,
            importBody.watch_time_share_c ?? 0,
          ]
          const total = shares.reduce((sum, val) => sum + val, 0)
          if (total < 90 || total > 110) {
            return validationErrorResponse('Watch time shares should sum to approximately 100')
          }
        }

        // Upsert result (one result per experiment)
        const { data: result, error: resultError } = await supabase
          .from('experiment_results')
          .upsert(
            {
              experiment_id: id,
              winner_variant_label: importBody.winner_variant_label,
              youtube_label: importBody.youtube_label?.trim() || null,
              watch_time_share_a: importBody.watch_time_share_a ?? null,
              watch_time_share_b: importBody.watch_time_share_b ?? null,
              watch_time_share_c: importBody.watch_time_share_c ?? null,
            },
            {
              onConflict: 'experiment_id',
            }
          )
          .select()
          .single()

        if (resultError) {
          logError(resultError, {
            route: 'POST /api/experiments/[id]/actions',
            userId: user.id,
            experimentId: id,
            action: 'import_result',
            operation: 'upsert-result',
          })
          return databaseErrorResponse('Failed to import result')
        }

        // Update experiment status to 'completed' and set completed_at
        const { data: updatedExperiment, error: updateError } = await supabase
          .from('experiments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (updateError) {
          logError(updateError, {
            route: 'POST /api/experiments/[id]/actions',
            userId: user.id,
            experimentId: id,
            action: 'import_result',
            operation: 'update-experiment',
          })
          return databaseErrorResponse('Failed to update experiment status')
        }

        logInfo('Experiment result imported', {
          route: 'POST /api/experiments/[id]/actions',
          userId: user.id,
          experimentId: id,
          winner: importBody.winner_variant_label,
        })

        // Fetch variants
        const { data: variants } = await supabase
          .from('experiment_variants')
          .select('*')
          .eq('experiment_id', id)
          .order('label', { ascending: true })

        const experimentResponse: ExperimentResponse = {
          ...updatedExperiment,
          variants: variants || [],
          result: result || undefined,
        }

        return NextResponse.json({ experiment: experimentResponse })
      }

      case 'update_status': {
        const statusBody = body as UpdateStatusRequest

        // Validate status
        if (!['draft', 'ready_for_studio', 'running', 'needs_import', 'completed'].includes(statusBody.status)) {
          return validationErrorResponse('Invalid status value')
        }

        // Update status
        const { data: updatedExperiment, error: updateError } = await supabase
          .from('experiments')
          .update({
            status: statusBody.status,
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (updateError) {
          logError(updateError, {
            route: 'POST /api/experiments/[id]/actions',
            userId: user.id,
            experimentId: id,
            action: 'update_status',
            operation: 'update-experiment',
          })
          return databaseErrorResponse('Failed to update experiment status')
        }

        logInfo('Experiment status updated', {
          route: 'POST /api/experiments/[id]/actions',
          userId: user.id,
          experimentId: id,
          newStatus: statusBody.status,
        })

        // Fetch variants and result
        const { data: variants } = await supabase
          .from('experiment_variants')
          .select('*')
          .eq('experiment_id', id)
          .order('label', { ascending: true })

        const { data: result } = await supabase
          .from('experiment_results')
          .select('*')
          .eq('experiment_id', id)
          .single()

        const experimentResponse: ExperimentResponse = {
          ...updatedExperiment,
          variants: variants || [],
          result: result || undefined,
        }

        return NextResponse.json({ experiment: experimentResponse })
      }

      default:
        return validationErrorResponse(`Unknown action: ${(body as { action: string }).action}`)
    }
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'perform-experiment-action', undefined, 'Failed to perform experiment action')
  }
}
