/**
 * Shared Project Gallery – Current User Access
 *
 * GET /api/projects/share/[slug]/me
 * Auth required. Returns whether the current user can comment on this shared project
 * (owner or project editor). Uses cookie client so RLS applies.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getProjectByShareSlug } from '@/lib/server/data/projects'
import { notFoundResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient()
    await requireAuth(supabase)
    const { slug } = await params

    if (!slug || typeof slug !== 'string') {
      return notFoundResponse('Share link not found')
    }

    const { data: project, error } = await getProjectByShareSlug(supabase, slug)

    if (error || !project) {
      return Response.json({ canComment: false, projectId: null })
    }

    return Response.json({
      canComment: true,
      projectId: project.id,
    })
  } catch (error) {
    return handleApiError(
      error,
      'GET /api/projects/share/[slug]/me',
      'shared-gallery-me',
      undefined,
      'Failed to check access'
    )
  }
}
