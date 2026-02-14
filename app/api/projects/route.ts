/**
 * Projects API Route
 *
 * GET: List projects for the authenticated user.
 * POST: Create a new project.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { ProjectInsert, ProjectDefaultSettings } from '@/lib/types/database'
import { listProjectsWithShared, createProject, listProjects } from '@/lib/server/data/projects'
import { createNotificationIfNew } from '@/lib/server/notifications/create'

export const revalidate = 60

/**
 * GET /api/projects
 * List projects for the authenticated user (id, name, created_at, updated_at, default_settings)
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const { data, error } = await listProjectsWithShared(supabase, user.id)

    if (error) {
      logError(error, {
        route: 'GET /api/projects',
        userId: user.id,
        operation: 'list-projects',
      })
      return databaseErrorResponse('Failed to fetch projects')
    }

    return NextResponse.json({ projects: data ?? [] })
  } catch (error) {
    return handleApiError(error, 'GET /api/projects', 'fetch-projects', undefined, 'Failed to fetch projects')
  }
}

/**
 * POST /api/projects
 * Create a new project. Body: name (required), optional default_settings (JSONB)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return validationErrorResponse('Project name is required')
    }

    const default_settings: ProjectDefaultSettings | null =
      body.default_settings != null && typeof body.default_settings === 'object'
        ? (body.default_settings as ProjectDefaultSettings)
        : null

    const insert: ProjectInsert = {
      user_id: user.id,
      name,
      ...(default_settings != null && { default_settings }),
    }

    const { data, error } = await createProject(supabase, insert)

    if (error) {
      logError(error, {
        route: 'POST /api/projects',
        userId: user.id,
        operation: 'create-project',
      })
      return databaseErrorResponse('Failed to create project')
    }

    const { data: projects } = await listProjects(supabase, user.id)
    const projectCount = projects?.length ?? 0

    if (projectCount === 1) {
      await createNotificationIfNew(user.id, 'first_project', {
        type: 'reward',
        title: 'Your first project',
        body: 'Start adding thumbnails to see it in action.',
        severity: 'success',
        action_url: '/studio',
        action_label: 'Go to Studio',
      })
    } else if ([5, 10, 25].includes(projectCount)) {
      await createNotificationIfNew(user.id, `project_milestone_${projectCount}`, {
        type: 'reward',
        title: `${projectCount} projects`,
        body: `You've created ${projectCount} projects. You're building a real library.`,
        severity: 'success',
        action_url: '/studio',
        action_label: 'View projects',
      })
    }

    return NextResponse.json({ project: data }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'POST /api/projects', 'create-project', undefined, 'Failed to create project')
  }
}
