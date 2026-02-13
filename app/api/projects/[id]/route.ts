/**
 * Project by ID API Route
 *
 * PATCH: Update project name and/or default_settings.
 * DELETE: Delete project (unlinks thumbnails first, then deletes project).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  notFoundResponse,
  validationErrorResponse,
  databaseErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { ProjectUpdate, ProjectDefaultSettings } from '@/lib/types/database'
import {
  getProjectById,
  updateProject,
  deleteProject,
  validateEditorSlug,
  getProjectByShareSlug,
  getProjectByEditorSlug,
} from '@/lib/server/data/projects'

/** Generate a short unique slug for share/editor links */
function generateShortSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

/**
 * PATCH /api/projects/[id]
 * Update name and/or default_settings. Body: name (optional), default_settings (optional, full replace).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    const body = await request.json()
    const update: ProjectUpdate = {}

    if (typeof body.name === 'string' && body.name.trim()) {
      update.name = body.name.trim()
    }
    if (body.default_settings !== undefined) {
      update.default_settings =
        body.default_settings != null && typeof body.default_settings === 'object'
          ? (body.default_settings as ProjectDefaultSettings)
          : null
    }

    if (body.share_slug !== undefined) {
      update.share_slug = body.share_slug === null || body.share_slug === '' ? null : String(body.share_slug).trim()
      if (update.share_slug === null) {
        update.share_mode = null
      }
    }
    if (body.share_mode !== undefined) {
      const mode = body.share_mode === 'all' || body.share_mode === 'favorites' ? body.share_mode : null
      update.share_mode = mode
      if (update.share_slug === undefined && mode != null) {
        const { data: existing } = await getProjectById(supabase, id, user.id)
        if (existing && !existing.share_slug) {
          let slug = generateShortSlug()
          for (let attempts = 0; attempts < 5; attempts++) {
            const { data: conflict } = await getProjectByShareSlug(supabase, slug)
            if (!conflict || conflict.id === id) break
            slug = generateShortSlug()
          }
          update.share_slug = slug
        }
      }
    }

    if (body.editor_link_enabled === true) {
      const { data: existing } = await getProjectById(supabase, id, user.id)
      if (existing && !existing.editor_slug) {
        let slug = generateShortSlug()
        for (let attempts = 0; attempts < 5; attempts++) {
          const { data: conflict } = await getProjectByEditorSlug(supabase, slug)
          if (!conflict || conflict.id === id) break
          slug = generateShortSlug()
        }
        update.editor_slug = slug
      }
    } else if (body.editor_link_enabled === false || body.editor_slug === null || body.editor_slug === '') {
      update.editor_slug = null
    } else if (body.editor_slug !== undefined && body.editor_slug != null && body.editor_slug !== '') {
      const slug = String(body.editor_slug).trim()
      if (!validateEditorSlug(slug)) {
        return validationErrorResponse('Invalid editor_slug: max 128 chars, alphanumeric and hyphen only')
      }
      update.editor_slug = slug
    }

    if (Object.keys(update).length === 0) {
      return validationErrorResponse('Provide name, default_settings, or share settings to update')
    }

    const { data, error } = await updateProject(supabase, id, user.id, update)

    if (error) {
      logError(error, {
        route: 'PATCH /api/projects/[id]',
        userId: user.id,
        projectId: id,
        operation: 'update-project',
      })
      return databaseErrorResponse('Failed to update project')
    }

    if (!data) {
      return notFoundResponse('Project not found')
    }

    return NextResponse.json({ project: data })
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'update-project', undefined, 'Failed to update project')
  }
}

/**
 * DELETE /api/projects/[id]
 * Set thumbnails.project_id to null for this project, then delete the project.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    const { error } = await deleteProject(supabase, id, user.id)

    if (error) {
      logError(error, {
        route: 'DELETE /api/projects/[id]',
        userId: user.id,
        projectId: id,
        operation: 'delete-project',
      })
      return databaseErrorResponse('Failed to delete project')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'delete-project', undefined, 'Failed to delete project')
  }
}
