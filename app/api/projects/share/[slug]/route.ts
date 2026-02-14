/**
 * Shared Project Gallery API (public, no auth required)
 *
 * GET: Returns project name, share_mode, and thumbnails. When the request
 * includes cookies and the user is authenticated, also returns canComment
 * and projectId (owner or editor can comment).
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFoundResponse, serverErrorResponse } from '@/lib/server/utils/error-handler'
import { getOptionalAuth } from '@/lib/server/utils/auth'
import { getProjectByShareSlug } from '@/lib/server/data/projects'
import { fetchThumbnailsForSharedProject } from '@/lib/server/data/thumbnails'
import { NextResponse } from 'next/server'

/**
 * GET /api/projects/share/[slug]
 * Public: project name, share_mode, thumbnails, count. When credentials are
 * sent and user is authenticated, also returns canComment and projectId.
 */
export async function GET(
  request: Request,
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

    const payload: {
      projectName: string
      shareMode: string
      thumbnails: unknown[]
      count: number
      canComment?: boolean
      projectId?: string | null
    } = {
      projectName: project.name,
      shareMode,
      thumbnails,
      count,
    }

    let cacheControl = 'public, s-maxage=60, stale-while-revalidate=120'

    const cookieStore = request.headers.get('cookie')
    if (cookieStore) {
      const cookieClient = await createClient()
      const user = await getOptionalAuth(cookieClient)
      if (user) {
        const { data: accessProject } = await getProjectByShareSlug(cookieClient, slug)
        payload.canComment = !!accessProject
        payload.projectId = accessProject?.id ?? null
        cacheControl = 'private, max-age=0'
      }
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': cacheControl },
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to load shared gallery')
  }
}
