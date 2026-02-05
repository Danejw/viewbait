/**
 * Thumbnail project assignment API Route
 *
 * POST /api/thumbnails/[id]/project
 * Body: { project_id: string | null }
 * Updates only the thumbnail's project_id (move to project or unassign).
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getProjectById } from '@/lib/server/data/projects'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  notFoundResponse,
  validationErrorResponse,
  databaseErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Verify user owns the thumbnail
    const { data: existing, error: checkError } = await supabase
      .from('thumbnails')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (checkError || !existing) {
      return notFoundResponse('Thumbnail not found or access denied')
    }

    let body: { project_id?: string | null }
    try {
      body = await request.json()
    } catch {
      return validationErrorResponse('Invalid JSON body')
    }
    if (body == null || typeof body !== 'object') {
      return validationErrorResponse('Body must be an object')
    }

    // project_id is required in body. Use null to unassign (set column to NULL = "No project").
    if (!('project_id' in body)) {
      return validationErrorResponse('project_id is required')
    }
    const projectId: string | null =
      body.project_id === undefined || body.project_id === null
        ? null
        : typeof body.project_id === 'string'
          ? body.project_id.trim() || null
          : null

    // Validate project exists and user is owner or editor when assigning to a project
    if (projectId != null) {
      const { data: project } = await getProjectByIdForAccess(supabase, projectId, user.id)
      if (!project) {
        return validationErrorResponse('Project not found or access denied')
      }
    }

    // Update only project_id: null unassigns the thumbnail (DB column set to NULL)
    const updatePayload = { project_id: projectId as string | null }
    const { data: thumbnail, error: updateError } = await supabase
      .from('thumbnails')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      logError(updateError, {
        route: 'POST /api/thumbnails/[id]/project',
        userId: user.id,
        operation: 'update-thumbnail-project',
        thumbnailId: id,
      })
      return databaseErrorResponse('Failed to update thumbnail project')
    }

    return NextResponse.json({ thumbnail })
  } catch (error) {
    return handleApiError(error, 'POST /api/thumbnails/[id]/project', 'update-thumbnail-project', undefined, 'Failed to update thumbnail project')
  }
}
