/**
 * Server-Side Projects Data
 *
 * CRUD for user projects. Used by API route handlers.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbProject, ProjectInsert, ProjectUpdate, ProjectDefaultSettings } from '@/lib/types/database'

const PROJECT_FIELDS = 'id,user_id,name,created_at,updated_at,default_settings,share_slug,share_mode'

/**
 * List projects for a user, ordered by updated_at desc
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
 * Get a single project by id; ensures it belongs to the user
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
