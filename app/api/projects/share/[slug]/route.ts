/**
 * Shared Project Gallery API (public, no auth)
 *
 * GET: Returns project name, share_mode, and thumbnails for the shared project.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { notFoundResponse, serverErrorResponse } from '@/lib/server/utils/error-handler'
import { getProjectByShareSlug } from '@/lib/server/data/projects'
import { fetchThumbnailsForSharedProject } from '@/lib/server/data/thumbnails'
import { NextResponse } from 'next/server'

/**
 * GET /api/projects/share/[slug]
 * Public: project name, share_mode, and thumbnails. No auth.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug || typeof slug !== 'string') {
      return notFoundResponse('Share link not found')
    }

    const supabase = createServiceClient()
    const { data: project, error: projectError } = await getProjectByShareSlug(supabase, slug)

    if (projectError || !project) {
      return notFoundResponse('Share link not found or no longer available')
    }

    const shareMode = project.share_mode === 'favorites' ? 'favorites' : 'all'
    const { thumbnails, count, error: thumbsError } = await fetchThumbnailsForSharedProject({
      projectId: project.id,
      shareMode,
      limit: 500,
      offset: 0,
    })

    if (thumbsError) {
      return serverErrorResponse(thumbsError, 'Failed to load gallery')
    }

    return NextResponse.json(
      {
        projectName: project.name,
        shareMode,
        thumbnails,
        count,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (error) {
    return serverErrorResponse(error, 'Failed to load shared gallery')
  }
}
