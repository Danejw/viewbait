/**
 * Server-Side Faces Data Fetching
 * 
 * Fetches face data server-side for SSR.
 * Reuses logic from app/api/faces/route.ts
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshFaceUrls } from '@/lib/server/utils/url-refresh'
import type { DbFace } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export interface BuildFacesQueryOptions {
  // No options currently, but structure allows for future expansion
}

export interface FetchFacesResult {
  faces: DbFace[]
  error: Error | null
}

/**
 * Build a faces query without executing it
 * Returns a query builder that can be further modified (e.g., for pagination)
 * 
 * @param supabase - Supabase client instance
 * @param user - Authenticated user
 * @param options - Query options (currently none, but structure allows for future expansion)
 * @returns Query builder (not executed)
 */
export function buildFacesQuery(
  supabase: SupabaseClient,
  user: User,
  options: BuildFacesQueryOptions = {}
): ReturnType<SupabaseClient['from']>['select'] {
  // Get user's faces - select only needed fields
  return supabase
    .from('faces')
    .select('id,name,image_urls,user_id,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
}

/**
 * Fetch faces for the authenticated user
 */
export async function fetchFaces(): Promise<FetchFacesResult> {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Build query using shared builder
    const query = buildFacesQuery(supabase, user, {})
    const { data, error } = await query

    if (error) {
      return {
        faces: [],
        error: error as Error,
      }
    }

    // Refresh signed URLs for all face images
    const facesWithUrls = await refreshFaceUrls(supabase, data || [], user.id)

    return {
      faces: facesWithUrls,
      error: null,
    }
  } catch (error) {
    return {
      faces: [],
      error: error instanceof Error ? error : new Error('Failed to fetch faces'),
    }
  }
}
