/**
 * Thumbnail Comments API
 *
 * GET: List comments for a thumbnail (auth required; project access enforced).
 * POST: Append a comment (auth required; project access + rate limit + CAS).
 * Uses cookie-based server client only; RLS enforces access.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getProjectByIdForAccess } from '@/lib/server/data/projects'
import { isUUID } from '@/lib/server/utils/uuid-validation'
import {
  notFoundResponse,
  validationErrorResponse,
  conflictResponse,
  forbiddenResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import type { ThumbnailComment } from '@/lib/types/database'

const COMMENT_MIN_LENGTH = 1
const COMMENT_MAX_LENGTH = 500
const RATE_LIMIT_PER_MINUTE = 5
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const CAS_MAX_RETRIES = 3

/** In-memory rate limit: key = `${userId}:${id}`, value = sorted list of request timestamps (ms). */
const rateLimitMap = new Map<string, number[]>()
function cleanupExpired(key: string, now: number) {
  const list = rateLimitMap.get(key) ?? []
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const kept = list.filter((t) => t > cutoff)
  if (kept.length === 0) rateLimitMap.delete(key)
  else rateLimitMap.set(key, kept)
  return kept
}
function checkRateLimit(userId: string, thumbnailId: string): boolean {
  const now = Date.now()
  const key = `${userId}:${thumbnailId}`
  const list = cleanupExpired(key, now)
  if (list.length >= RATE_LIMIT_PER_MINUTE) return false
  list.push(now)
  rateLimitMap.set(key, list.sort((a, b) => a - b))
  return true
}

function parseComments(raw: unknown): ThumbnailComment[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is ThumbnailComment =>
      item != null &&
      typeof item === 'object' &&
      typeof (item as ThumbnailComment).user_id === 'string' &&
      typeof (item as ThumbnailComment).comment === 'string' &&
      typeof (item as ThumbnailComment).created_at === 'string'
  )
}

/**
 * GET /api/thumbnails/[id]/comments?projectId=... (optional)
 * When projectId is present: user must have project access (owner or editor).
 * When projectId is omitted: only the thumbnail owner can read comments.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const projectIdParam = searchParams.get('projectId')

    if (!isUUID(id)) {
      return validationErrorResponse('Valid thumbnail id (UUID) is required')
    }

    if (projectIdParam != null && projectIdParam !== '') {
      if (!isUUID(projectIdParam)) {
        return validationErrorResponse('Valid projectId (UUID) is required when provided')
      }
      const { data: project } = await getProjectByIdForAccess(supabase, projectIdParam, user.id)
      if (!project) {
        return notFoundResponse('Project not found or access denied')
      }
      const { data: row, error } = await supabase
        .from('thumbnails')
        .select('id, comments')
        .eq('id', id)
        .eq('project_id', projectIdParam)
        .maybeSingle()
      if (error || !row) {
        return notFoundResponse('Thumbnail not found')
      }
      const comments = parseComments(row.comments ?? [])
      return Response.json({ comments })
    }

    // Owner-only: no projectId – require thumbnail owner
    const { data: row, error } = await supabase
      .from('thumbnails')
      .select('id, user_id, comments')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return notFoundResponse('Thumbnail not found')
    }
    if (!row || row.user_id !== user.id) {
      return forbiddenResponse('Not the thumbnail owner')
    }

    const comments = parseComments(row.comments ?? [])
    return Response.json({ comments })
  } catch (error) {
    return handleApiError(
      error,
      'GET /api/thumbnails/[id]/comments',
      'get-thumbnail-comments',
      undefined,
      'Failed to get comments'
    )
  }
}

/**
 * POST /api/thumbnails/[id]/comments
 * Body: { projectId: string, comment: string }
 * Appends a comment using optimistic CAS (no RPC). Rate limited per (user, thumbnail).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    if (!isUUID(id)) {
      return validationErrorResponse('Valid thumbnail id (UUID) is required')
    }

    let body: { projectId?: string; comment?: string }
    try {
      body = await request.json()
    } catch {
      return validationErrorResponse('Invalid JSON body')
    }
    const projectId =
      body != null && typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const rawComment =
      body != null && typeof body.comment === 'string' ? body.comment : ''
    const trimmedComment = rawComment.trim()

    if (!projectId || !isUUID(projectId)) {
      return validationErrorResponse('Valid projectId (UUID) is required')
    }
    if (
      trimmedComment.length < COMMENT_MIN_LENGTH ||
      trimmedComment.length > COMMENT_MAX_LENGTH
    ) {
      return validationErrorResponse(
        `Comment must be between ${COMMENT_MIN_LENGTH} and ${COMMENT_MAX_LENGTH} characters`
      )
    }

    if (!checkRateLimit(user.id, id)) {
      return Response.json(
        { error: 'Too many comments; try again in a minute', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429 }
      )
    }

    const { data: project } = await getProjectByIdForAccess(supabase, projectId, user.id)
    if (!project) {
      return notFoundResponse('Project not found or access denied')
    }

    const newComment: ThumbnailComment = {
      user_id: user.id,
      comment: trimmedComment,
      created_at: new Date().toISOString(),
    }

    let lastComments: ThumbnailComment[] = []
    let lastUpdatedAt: string | null = null

    for (let attempt = 0; attempt < CAS_MAX_RETRIES; attempt++) {
      const { data: row, error: selectError } = await supabase
        .from('thumbnails')
        .select('id, project_id, comments, updated_at')
        .eq('id', id)
        .eq('project_id', projectId)
        .maybeSingle()

      if (selectError || !row) {
        return notFoundResponse('Thumbnail not found')
      }

      const currentComments = parseComments(row.comments ?? [])
      const prevUpdatedAt =
        row.updated_at != null ? String(row.updated_at) : null
      lastComments = [...currentComments, newComment]
      lastUpdatedAt = prevUpdatedAt

      const updatePayload: { comments: ThumbnailComment[]; updated_at: string } = {
        comments: lastComments,
        updated_at: new Date().toISOString(),
      }

      let updateQuery = supabase
        .from('thumbnails')
        .update(updatePayload)
        .eq('id', id)
        .eq('project_id', projectId)

      if (prevUpdatedAt != null) {
        updateQuery = updateQuery.eq('updated_at', prevUpdatedAt)
      }

      const { data: updated, error: updateError } = await updateQuery
        .select('comments, updated_at')
        .maybeSingle()

      if (!updateError && updated != null) {
        const comments = parseComments(updated.comments ?? [])
        return Response.json({ comments })
      }
      if (updateError) {
        return handleApiError(
          updateError,
          'POST /api/thumbnails/[id]/comments',
          'post-thumbnail-comment',
          undefined,
          'Failed to save comment'
        )
      }
      // 0 rows updated (CAS failed); retry
    }

    return conflictResponse('Please retry')
  } catch (error) {
    return handleApiError(
      error,
      'POST /api/thumbnails/[id]/comments',
      'post-thumbnail-comment',
      undefined,
      'Failed to post comment'
    )
  }
}
