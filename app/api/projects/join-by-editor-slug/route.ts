/**
 * Join project by editor slug API Route
 *
 * POST /api/projects/join-by-editor-slug
 * Body: { editor_slug: string }
 * Resolves project by editor_slug (service client), adds current user to project_editors (idempotent),
 * returns project so client can redirect to /studio?project=<id>.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  notFoundResponse,
  databaseErrorResponse,
  rateLimitResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { checkRateLimit } from '@/lib/server/utils/rate-limit'
import { NextResponse } from 'next/server'
import {
  getProjectByEditorSlug,
  addProjectEditor,
  validateEditorSlug,
} from '@/lib/server/data/projects'

/** Max join-by-editor-slug requests per user per minute (reduces slug enumeration / abuse). */
const JOIN_BY_EDITOR_SLUG_LIMIT_PER_MINUTE = 10

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    if (!checkRateLimit(`join-editor-slug:${user.id}`, JOIN_BY_EDITOR_SLUG_LIMIT_PER_MINUTE)) {
      return rateLimitResponse('Too many join attempts. Please try again in a minute.')
    }

    let body: { editor_slug?: string }
    try {
      body = await request.json()
    } catch {
      return validationErrorResponse('Invalid JSON body')
    }
    const rawSlug = body?.editor_slug
    const editorSlug = typeof rawSlug === 'string' ? rawSlug.trim() : ''
    if (!editorSlug) {
      return validationErrorResponse('editor_slug is required')
    }
    if (!validateEditorSlug(editorSlug)) {
      return validationErrorResponse('Invalid editor_slug: max 128 chars, alphanumeric and hyphen only')
    }

    const service = createServiceClient()
    const { data: project, error: lookupError } = await getProjectByEditorSlug(service, editorSlug)
    if (lookupError) {
      logError(lookupError, {
        route: 'POST /api/projects/join-by-editor-slug',
        userId: user.id,
        operation: 'get-project-by-editor-slug',
      })
      return databaseErrorResponse('Failed to resolve project')
    }
    if (!project) {
      return notFoundResponse('Project not found or link is invalid')
    }

    const { error: insertError } = await addProjectEditor(service, project.id, user.id)
    if (insertError) {
      logError(insertError, {
        route: 'POST /api/projects/join-by-editor-slug',
        userId: user.id,
        projectId: project.id,
        operation: 'add-project-editor',
      })
      return databaseErrorResponse('Failed to add you to the project')
    }

    return NextResponse.json({ project })
  } catch (error) {
    return handleApiError(
      error,
      'POST /api/projects/join-by-editor-slug',
      'join-by-editor-slug',
      undefined,
      'Failed to join project'
    )
  }
}
