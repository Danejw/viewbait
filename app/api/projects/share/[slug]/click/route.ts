/**
 * Shared Project Gallery — Record thumbnail click (public, no auth)
 *
 * POST: Increments share_click_count for a thumbnail that belongs to the shared project.
 * Validates slug → project → thumbnail before atomic increment.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getProjectByShareSlug } from '@/lib/server/data/projects'
import { notFoundResponse, validationErrorResponse, serverErrorResponse } from '@/lib/server/utils/error-handler'
import { NextResponse } from 'next/server'

/** Body: thumbnailId (UUID) */
interface ClickRequestBody {
  thumbnailId?: string
}

/**
 * POST /api/projects/share/[slug]/click
 * Public: no auth. Body: { thumbnailId: string }.
 * Returns 204 on success; 400 invalid body; 404 slug or thumbnail not in project.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug || typeof slug !== 'string') {
      return notFoundResponse('Share link not found')
    }

    let body: ClickRequestBody
    try {
      body = (await request.json()) as ClickRequestBody
    } catch {
      return validationErrorResponse('Request body must be JSON')
    }

    const thumbnailId =
      typeof body?.thumbnailId === 'string' ? body.thumbnailId.trim() : undefined
    if (!thumbnailId) {
      return validationErrorResponse('thumbnailId is required')
    }

    // UUID format sanity check (basic)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(thumbnailId)) {
      return validationErrorResponse('thumbnailId must be a valid UUID')
    }

    const supabase = createServiceClient()
    const { data: project, error: projectError } = await getProjectByShareSlug(supabase, slug)

    if (projectError || !project) {
      return notFoundResponse('Share link not found or no longer available')
    }

    const { data: thumbnail, error: thumbError } = await supabase
      .from('thumbnails')
      .select('id')
      .eq('id', thumbnailId)
      .eq('project_id', project.id)
      .maybeSingle()

    if (thumbError || !thumbnail) {
      return notFoundResponse('Thumbnail not found or not in this project')
    }

    const { error: rpcError } = await supabase.rpc('increment_thumbnail_share_click_count', {
      p_thumbnail_id: thumbnailId,
      p_project_id: project.id,
    })

    if (rpcError) {
      console.error('[share/click] RPC error:', rpcError)
      return serverErrorResponse(rpcError, 'Failed to record click')
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[share/click] Unexpected error:', error)
    return serverErrorResponse(error, 'Failed to record click')
  }
}
