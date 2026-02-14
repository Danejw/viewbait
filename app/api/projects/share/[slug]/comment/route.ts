/**
 * Shared Project Gallery — Add comment to thumbnail (public, optional auth)
 *
 * POST: Adds a comment to a thumbnail that belongs to the shared project.
 * Validates slug → project → thumbnail before adding comment.
 * Supports both authenticated and anonymous comments.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { getProjectByShareSlug } from '@/lib/server/data/projects'
import { notFoundResponse, validationErrorResponse, serverErrorResponse } from '@/lib/server/utils/error-handler'
import { NextResponse } from 'next/server'

/** Body: thumbnailId (UUID), comment (text), optional user_id if authenticated */
interface CommentRequestBody {
  thumbnailId?: string
  comment?: string
}

/**
 * POST /api/projects/share/[slug]/comment
 * Public: optional auth. Body: { thumbnailId: string, comment: string }.
 * Returns 200 with updated comments array on success; 400 invalid body; 404 slug or thumbnail not in project.
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

    let body: CommentRequestBody
    try {
      body = (await request.json()) as CommentRequestBody
    } catch {
      return validationErrorResponse('Request body must be JSON')
    }

    const thumbnailId =
      typeof body?.thumbnailId === 'string' ? body.thumbnailId.trim() : undefined
    if (!thumbnailId) {
      return validationErrorResponse('thumbnailId is required')
    }

    const commentText =
      typeof body?.comment === 'string' ? body.comment.trim() : undefined
    if (!commentText || commentText.length === 0) {
      return validationErrorResponse('comment is required and cannot be empty')
    }

    // Validate comment length (max 2000 characters)
    if (commentText.length > 2000) {
      return validationErrorResponse('comment must be 2000 characters or less')
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

    // Try to get authenticated user (optional)
    let userId: string | null = null
    try {
      const sessionSupabase = await createClient()
      const { data: { user } } = await sessionSupabase.auth.getUser()
      if (user) {
        userId = user.id
      }
    } catch {
      // Not authenticated, continue with anonymous comment
    }

    const { data: comments, error: rpcError } = await supabase.rpc('add_thumbnail_comment', {
      p_thumbnail_id: thumbnailId,
      p_project_id: project.id,
      p_comment_text: commentText,
      p_user_id: userId,
    })

    if (rpcError) {
      console.error('[share/comment] RPC error:', rpcError)
      return serverErrorResponse(rpcError, 'Failed to add comment')
    }

    return NextResponse.json({ comments }, { status: 200 })
  } catch (error) {
    console.error('[share/comment] Unexpected error:', error)
    return serverErrorResponse(error, 'Failed to add comment')
  }
}
