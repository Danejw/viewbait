/**
 * Projects Service
 *
 * Handles project CRUD via secure API routes.
 */

import { fetchWithTimeout, DEFAULT_LIST_DETAIL_TIMEOUT_MS } from '@/lib/utils/fetch-with-timeout'
import type {
  DbProject,
  ProjectInsert,
  ProjectUpdate,
  ProjectDefaultSettings,
  PublicThumbnailData,
  ShareMode,
} from '@/lib/types/database'

export type { ProjectDefaultSettings, ShareMode }

export interface CreateProjectPayload {
  name: string
  default_settings?: ProjectDefaultSettings | null
}

export interface UpdateProjectPayload {
  name?: string
  default_settings?: ProjectDefaultSettings | null
  share_slug?: string | null
  share_mode?: ShareMode | null
  editor_slug?: string | null
  /** Set true to enable editor link (server generates editor_slug); set false to disable */
  editor_link_enabled?: boolean
}

/**
 * List projects for the authenticated user
 */
export async function getProjects(): Promise<{
  projects: DbProject[]
  error: Error | null
}> {
  try {
    const response = await fetchWithTimeout('/api/projects', {
      credentials: 'include',
      timeoutMs: DEFAULT_LIST_DETAIL_TIMEOUT_MS,
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        projects: [],
        error: new Error(errorData.error || 'Failed to fetch projects'),
      }
    }
    const data = await response.json()
    return {
      projects: data.projects ?? [],
      error: null,
    }
  } catch (error) {
    return {
      projects: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Create a project
 */
export async function createProject(payload: CreateProjectPayload): Promise<{
  project: DbProject | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        project: null,
        error: new Error(errorData.error || 'Failed to create project'),
      }
    }
    const data = await response.json()
    return { project: data.project ?? null, error: null }
  } catch (error) {
    return {
      project: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Update a project (name and/or default_settings)
 */
export async function updateProject(
  id: string,
  payload: UpdateProjectPayload
): Promise<{
  project: DbProject | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        project: null,
        error: new Error(errorData.error || 'Failed to update project'),
      }
    }
    const data = await response.json()
    return { project: data.project ?? null, error: null }
  } catch (error) {
    return {
      project: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Join a project by editor slug (e.g. from /e/[slug]). Returns the project so client can redirect to /studio?project=<id>.
 */
export async function joinByEditorSlug(editorSlug: string): Promise<{
  project: DbProject | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/projects/join-by-editor-slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editor_slug: editorSlug }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        project: null,
        error: new Error(errorData.error || 'Failed to join project'),
      }
    }
    const data = await response.json()
    return { project: data.project ?? null, error: null }
  } catch (error) {
    return {
      project: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Delete a project (unlinks thumbnails first, then deletes)
 */
export async function deleteProject(id: string): Promise<{
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        error: new Error(errorData.error || 'Failed to delete project'),
      }
    }
    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Response shape for shared project gallery (public, no auth required).
 * When the client sends credentials and the user is owner/editor, canComment and projectId are set.
 */
export interface SharedProjectGalleryResponse {
  projectName: string
  shareMode: 'all' | 'favorites'
  thumbnails: PublicThumbnailData[]
  count: number
  canComment?: boolean
  projectId?: string | null
}

/**
 * Check if the current user can comment on a shared project (owner or editor).
 * Requires auth; use when user is logged in on the shared gallery page.
 */
export async function getSharedProjectGalleryAccess(slug: string): Promise<{
  canComment: boolean
  projectId: string | null
  error: Error | null
}> {
  try {
    const response = await fetch(
      `/api/projects/share/${encodeURIComponent(slug)}/me`,
      { credentials: 'include' }
    )
    if (!response.ok) {
      if (response.status === 401) {
        return { canComment: false, projectId: null, error: null }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        canComment: false,
        projectId: null,
        error: new Error(errorData.error || 'Failed to check access'),
      }
    }
    const data = await response.json()
    return {
      canComment: data.canComment === true,
      projectId: data.projectId ?? null,
      error: null,
    }
  } catch (error) {
    return {
      canComment: false,
      projectId: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get shared project gallery by share slug. Send credentials so the server
 * can include canComment and projectId when the user is authenticated.
 */
export async function getSharedProjectGallery(slug: string): Promise<{
  data: SharedProjectGalleryResponse | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/projects/share/${encodeURIComponent(slug)}`, {
      credentials: 'include',
    })
    if (!response.ok) {
      if (response.status === 404) {
        return { data: null, error: new Error('Share link not found or no longer available') }
      }
      const errorData = await response.json().catch(() => ({}))
      return {
        data: null,
        error: new Error(errorData.error || 'Failed to load shared gallery'),
      }
    }
    const data = await response.json()
    const result: SharedProjectGalleryResponse = {
      projectName: data.projectName ?? '',
      shareMode: data.shareMode === 'favorites' ? 'favorites' : 'all',
      thumbnails: data.thumbnails ?? [],
      count: data.count ?? 0,
    }
    if (typeof data.canComment === 'boolean') result.canComment = data.canComment
    if (data.projectId !== undefined) result.projectId = data.projectId ?? null
    return { data: result, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Record a thumbnail click on a shared project gallery (public, no auth).
 * Fire-and-forget: does not throw; use for analytics only.
 */
export async function recordSharedProjectClick(
  slug: string,
  thumbnailId: string
): Promise<void> {
  try {
    await fetch(`/api/projects/share/${encodeURIComponent(slug)}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thumbnailId }),
    })
  } catch {
    // Fire-and-forget: do not surface errors to the user
  }
}
