/**
 * Server-Side Projects Data
 *
 * CRUD for user projects. Used by API route handlers.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbProject, ProjectInsert, ProjectUpdate, ProjectDefaultSettings } from '@/lib/types/database'

const PROJECT_FIELDS = 'id,user_id,name,created_at,updated_at,default_settings,share_slug,share_mode,editor_slug'

/** Max length and allowed charset for editor_slug (URL-safe). */
const EDITOR_SLUG_MAX_LENGTH = 128
const EDITOR_SLUG_REGEX = /^[a-zA-Z0-9-]+$/

export function validateEditorSlug(slug: string): boolean {
  if (typeof slug !== 'string' || slug.length === 0 || slug.length > EDITOR_SLUG_MAX_LENGTH) return false
  return EDITOR_SLUG_REGEX.test(slug)
}

/**
 * List projects for a user (owned + shared as editor), with isShared flag.
 * Two-query merge: (1) owned projects, (2) project_editors → fetch those projects, merge with isShared: true.
 */
export interface ProjectWithShared extends DbProject {
  isShared?: boolean
}

export async function listProjectsWithShared(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: ProjectWithShared[]; error: Error | null }> {
  const owned = await supabase
    .from('projects')
    .select(PROJECT_FIELDS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (owned.error) {
    return { data: [], error: owned.error as Error }
  }

  const editorRows = await supabase
    .from('project_editors')
    .select('project_id')
    .eq('user_id', userId)

  if (editorRows.error) {
    return { data: (owned.data ?? []) as ProjectWithShared[], error: null }
  }

  const editorProjectIds = (editorRows.data ?? []).map((r: { project_id: string }) => r.project_id)
  if (editorProjectIds.length === 0) {
    const list = (owned.data ?? []) as ProjectWithShared[]
    list.forEach((p) => { p.isShared = false })
    return { data: list, error: null }
  }

  const sharedProjects = await supabase
    .from('projects')
    .select(PROJECT_FIELDS)
    .in('id', editorProjectIds)

  if (sharedProjects.error) {
    const list = (owned.data ?? []) as ProjectWithShared[]
    list.forEach((p) => { p.isShared = false })
    return { data: list, error: null }
  }

  const sharedList = (sharedProjects.data ?? []) as ProjectWithShared[]
  sharedList.forEach((p) => { p.isShared = true })

  const merged = [
    ...(owned.data ?? []).map((p: DbProject) => ({ ...p, isShared: false } as ProjectWithShared)),
    ...sharedList,
  ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  return { data: merged, error: null }
}

/**
 * List projects for a user (owned only), ordered by updated_at desc.
 * Prefer listProjectsWithShared for UI that shows owned + shared.
 */
export async function listProjects(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: DbProject[]; error: Error | null }> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_FIELDS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    return { data: [], error: error as Error }
  }
  return { data: (data ?? []) as DbProject[], error: null }
}

/**
 * Public-safe project info for shared gallery (by share_slug, no auth).
 * Caller must use service client when not authenticated.
 */
export interface ProjectByShareSlugRow {
  id: string
  name: string
  share_mode: 'all' | 'favorites' | null
}

/**
 * Get project by share_slug; returns only public-safe fields. Use with service client for unauthenticated access.
 */
export async function getProjectByShareSlug(
  supabase: SupabaseClient,
  shareSlug: string
): Promise<{ data: ProjectByShareSlugRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('projects')
    .select('id,name,share_mode')
    .eq('share_slug', shareSlug)
    .not('share_slug', 'is', null)
    .maybeSingle()

  if (error) {
    return { data: null, error: error as Error }
  }
  return { data: data as ProjectByShareSlugRow | null, error: null }
}

/**
 * Get a single project by id; ensures it belongs to the user (owner only)
 */
export async function getProjectById(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<{ data: DbProject | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_FIELDS)
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return { data: null, error: error as Error }
  }
  return { data: data as DbProject | null, error: null }
}

/**
 * Get a project by id if the user is owner or editor (for generate/thumbnail assignment).
 */
export async function getProjectByIdForAccess(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<{ data: DbProject | null; error: Error | null }> {
  const { data: owned, error: ownedError } = await supabase
    .from('projects')
    .select(PROJECT_FIELDS)
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (ownedError) return { data: null, error: ownedError as Error }
  if (owned) return { data: owned as DbProject, error: null }

  const { data: editorRow } = await supabase
    .from('project_editors')
    .select('project_id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!editorRow) return { data: null, error: null }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select(PROJECT_FIELDS)
    .eq('id', projectId)
    .maybeSingle()

  if (projectError) return { data: null, error: projectError as Error }
  return { data: project as DbProject, error: null }
}

/**
 * Get project by editor_slug (service client only – RLS blocks access to other users' projects).
 */
export async function getProjectByEditorSlug(
  supabase: SupabaseClient,
  editorSlug: string
): Promise<{ data: DbProject | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_FIELDS)
    .eq('editor_slug', editorSlug)
    .not('editor_slug', 'is', null)
    .maybeSingle()

  if (error) return { data: null, error: error as Error }
  return { data: data as DbProject | null, error: null }
}

/**
 * Add user as editor to a project (idempotent). Use service client so insert is allowed.
 */
export async function addProjectEditor(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('project_editors').upsert(
    { project_id: projectId, user_id: userId },
    { onConflict: 'project_id,user_id' }
  )
  return { error: error ? (error as Error) : null }
}

/**
 * Create a project
 */
export async function createProject(
  supabase: SupabaseClient,
  insert: ProjectInsert
): Promise<{ data: DbProject | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('projects')
    .insert(insert)
    .select(PROJECT_FIELDS)
    .single()

  if (error) {
    return { data: null, error: error as Error }
  }
  return { data: data as DbProject, error: null }
}

/**
 * Update a project (name and/or default_settings). Ensures ownership in caller.
 */
export async function updateProject(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  update: ProjectUpdate
): Promise<{ data: DbProject | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', projectId)
    .eq('user_id', userId)
    .select(PROJECT_FIELDS)
    .single()

  if (error) {
    return { data: null, error: error as Error }
  }
  return { data: data as DbProject, error: null }
}

/**
 * Delete a project: set thumbnails.project_id to null for that project, then delete project
 */
export async function deleteProject(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const { error: updateError } = await supabase
    .from('thumbnails')
    .update({ project_id: null })
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (updateError) {
    return { error: updateError as Error }
  }

  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)

  if (deleteError) {
    return { error: deleteError as Error }
  }
  return { error: null }
}

export type { ProjectDefaultSettings }
