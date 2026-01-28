/**
 * Server-Side Palettes Data Fetching
 * 
 * Fetches palette data server-side for SSR.
 * Reuses logic from app/api/palettes/route.ts
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import type { DbPalette, PublicPalette } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export interface BuildPalettesQueryOptions {
  userOnly?: boolean
  publicOnly?: boolean
  defaultsOnly?: boolean
}

export interface FetchPalettesOptions {
  userOnly?: boolean
  publicOnly?: boolean
  defaultsOnly?: boolean
}

export interface FetchPalettesResult {
  palettes: DbPalette[]
  error: Error | null
}

export interface FetchPublicPalettesResult {
  palettes: PublicPalette[]
  error: Error | null
}

/**
 * Build a palettes query without executing it
 * Returns a query builder that can be further modified (e.g., for pagination)
 * 
 * Note: For publicOnly=true, this returns null because public_palettes is a view
 * that requires a separate query. The caller should handle this case.
 * 
 * @param supabase - Supabase client instance
 * @param user - Authenticated user
 * @param options - Query options (userOnly, publicOnly, defaultsOnly)
 * @returns Query builder (not executed) or null for publicOnly
 */
export function buildPalettesQuery(
  supabase: SupabaseClient,
  user: User,
  options: BuildPalettesQueryOptions = {}
): ReturnType<SupabaseClient['from']>['select'] | null {
  const {
    userOnly = false,
    publicOnly = false,
    defaultsOnly = false,
  } = options

  // Select only needed fields for better performance
  let query = supabase.from('palettes').select('id,name,colors,is_default,is_public,user_id,created_at')

  if (userOnly) {
    // Only user's own palettes
    query = query.eq('user_id', user.id)
  } else if (publicOnly) {
    // For publicOnly, we need to use the public_palettes view
    // Return null to indicate this requires a separate query
    return null
  } else if (defaultsOnly) {
    // Only default palettes
    query = query.eq('is_default', true).order('name', { ascending: true })
  } else {
    // All accessible palettes (own + defaults + public)
    query = query
      .or(`user_id.eq.${user.id},is_default.eq.true,is_public.eq.true`)
      .order('created_at', { ascending: false })
  }

  return query
}

/**
 * Fetch palettes accessible to the authenticated user (own + defaults + public)
 */
export async function fetchPalettes(
  options: FetchPalettesOptions = {}
): Promise<FetchPalettesResult> {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const {
      userOnly = false,
      publicOnly = false,
      defaultsOnly = false,
    } = options

    // Handle publicOnly as a special case (uses different view)
    if (publicOnly) {
      // Only public palettes (use view) - select only needed fields
      const { data, error } = await supabase
        .from('public_palettes')
        .select('id,name,colors,is_default,is_public,created_at')
        .order('created_at', { ascending: false })

      if (error) {
        return {
          palettes: [],
          error: error as Error,
        }
      }

      return {
        palettes: (data || []) as DbPalette[],
        error: null,
      }
    }

    // Build query using shared builder
    const query = buildPalettesQuery(supabase, user, {
      userOnly,
      publicOnly: false, // Already handled above
      defaultsOnly,
    })

    if (!query) {
      return {
        palettes: [],
        error: new Error('Invalid query configuration'),
      }
    }

    const { data, error } = await query

    if (error) {
      return {
        palettes: [],
        error: error as Error,
      }
    }

    return {
      palettes: data || [],
      error: null,
    }
  } catch (error) {
    return {
      palettes: [],
      error: error instanceof Error ? error : new Error('Failed to fetch palettes'),
    }
  }
}

/**
 * Fetch public palettes only
 */
export async function fetchPublicPalettes(): Promise<FetchPublicPalettesResult> {
  try {
    const supabase = await createClient()
    await requireAuth(supabase) // Still require auth to access public palettes

    const { data, error } = await supabase
      .from('public_palettes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return {
        palettes: [],
        error: error as Error,
      }
    }

    return {
      palettes: (data || []) as PublicPalette[],
      error: null,
    }
  } catch (error) {
    return {
      palettes: [],
      error: error instanceof Error ? error : new Error('Failed to fetch public palettes'),
    }
  }
}
