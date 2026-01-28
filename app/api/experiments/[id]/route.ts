/**
 * Experiment by ID API Route
 * 
 * Handles GET, PATCH, and DELETE operations for a specific experiment.
 * All operations are server-side only for security.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/server/utils/error-handler'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { ExperimentResponse } from '../route'

export interface ExperimentUpdateRequest {
  status?: 'draft' | 'ready_for_studio' | 'running' | 'needs_import' | 'completed'
  notes?: string | null
  started_at?: string | null
  completed_at?: string | null
}

/**
 * GET /api/experiments/[id]
 * Get a specific experiment with variants and result
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Fetch experiment
    const { data: experiment, error: fetchError } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !experiment) {
      if (fetchError?.code === 'PGRST116') {
        return notFoundResponse('Experiment not found')
      }
      logError(fetchError, {
        route: 'GET /api/experiments/[id]',
        userId: user.id,
        experimentId: id,
        operation: 'fetch-experiment',
      })
      return databaseErrorResponse('Failed to fetch experiment')
    }

    // Fetch variants
    const { data: variants } = await supabase
      .from('experiment_variants')
      .select('*')
      .eq('experiment_id', id)
      .order('label', { ascending: true })

    // Fetch result
    const { data: result } = await supabase
      .from('experiment_results')
      .select('*')
      .eq('experiment_id', id)
      .single()

    const experimentResponse: ExperimentResponse = {
      ...experiment,
      variants: variants || [],
      result: result || undefined,
    }

    return NextResponse.json({ experiment: experimentResponse })
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to fetch experiment')
  }
}

/**
 * PATCH /api/experiments/[id]
 * Update a specific experiment
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Parse request body
    const body: ExperimentUpdateRequest = await request.json()

    // Validate status if provided
    if (body.status && !['draft', 'ready_for_studio', 'running', 'needs_import', 'completed'].includes(body.status)) {
      return validationErrorResponse('Invalid status value')
    }

    // Build update object (only include provided fields)
    const updateData: Partial<ExperimentUpdateRequest> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null
    if (body.started_at !== undefined) updateData.started_at = body.started_at
    if (body.completed_at !== undefined) updateData.completed_at = body.completed_at

    // Update experiment (RLS ensures user can only update their own)
    const { data: experiment, error: updateError } = await supabase
      .from('experiments')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return notFoundResponse('Experiment not found')
      }
      logError(updateError, {
        route: 'PATCH /api/experiments/[id]',
        userId: user.id,
        experimentId: id,
        operation: 'update-experiment',
      })
      return databaseErrorResponse('Failed to update experiment')
    }

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
      ...experiment,
      variants: variants || [],
      result: result || undefined,
    }

    return NextResponse.json({ experiment: experimentResponse })
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to update experiment')
  }
}

/**
 * DELETE /api/experiments/[id]
 * Delete a specific experiment (cascades to variants and results)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Delete experiment (RLS ensures user can only delete their own, cascade deletes variants and results)
    const { error: deleteError } = await supabase
      .from('experiments')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      logError(deleteError, {
        route: 'DELETE /api/experiments/[id]',
        userId: user.id,
        experimentId: id,
        operation: 'delete-experiment',
      })
      return databaseErrorResponse('Failed to delete experiment')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to delete experiment')
  }
}
