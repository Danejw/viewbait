/**
 * Server-Side Styles Data Fetching
 * 
 * Fetches style data server-side for SSR.
 * Reuses logic from app/api/styles/route.ts
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshStyleUrls } from '@/lib/server/utils/url-refresh'
import type { DbStyle, PublicStyle } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export interface BuildStylesQueryOptions {
  userOnly?: boolean
  publicOnly?: boolean
  defaultsOnly?: boolean
}

export interface FetchStylesOptions {
  userOnly?: boolean
  publicOnly?: boolean
  defaultsOnly?: boolean
}

export interface FetchStylesResult {
  styles: DbStyle[]
  error: Error | null
}

export interface FetchPublicStylesResult {
  styles: PublicStyle[]
  error: Error | null
}

/** Thenable returned by Supabase query builders; awaited to get { data, error } */
type StylesQueryBuilder = PromiseLike<{ data: unknown[] | null; error: unknown }>

/**
 * Build a styles query without executing it
 * Returns a query builder that can be further modified (e.g., for pagination)
 *
 * Note: For publicOnly=true, this returns null because public_styles is a view
 * that requires a separate query. The caller should handle this case.
 *
 * @param supabase - Supabase client instance
 * @param user - Authenticated user
 * @param options - Query options (userOnly, publicOnly, defaultsOnly)
 * @returns Query builder (not executed) or null for publicOnly
 */
export function buildStylesQuery(
  supabase: SupabaseClient,
  user: User,
  options: BuildStylesQueryOptions = {}
): StylesQueryBuilder | null {
  const {
    userOnly = false,
    publicOnly = false,
    defaultsOnly = false,
  } = options

  // Select only needed fields for better performance
  const baseQuery = supabase
    .from('styles')
    .select('id,name,description,prompt,reference_images,preview_thumbnail_url,is_default,is_public,user_id,created_at')

  if (userOnly) {
    return baseQuery.eq('user_id', user.id).order('created_at', { ascending: false }) as StylesQueryBuilder
  }
  if (publicOnly) {
    return null
  }
  if (defaultsOnly) {
    return baseQuery.eq('is_default', true).order('name', { ascending: true }) as StylesQueryBuilder
  }
  return baseQuery
    .or(`user_id.eq.${user.id},is_default.eq.true,is_public.eq.true`)
    .order('created_at', { ascending: false }) as StylesQueryBuilder
}

/**
 * Fetch styles accessible to the authenticated user (own + defaults + public)
 */
export async function fetchStyles(
  options: FetchStylesOptions = {}
): Promise<FetchStylesResult> {
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
      // Only public styles (use view) - select only public fields
      const { data, error } = await supabase
        .from('public_styles')
        .select('id,name,description,preview_thumbnail_url')

      if (error) {
        return {
          styles: [],
          error: error as Error,
        }
      }

      return {
        styles: (data || []) as DbStyle[],
        error: null,
      }
    }

    // Build query using shared builder
    const query = buildStylesQuery(supabase, user, {
      userOnly,
      publicOnly: false, // Already handled above
      defaultsOnly,
    })

    if (!query) {
      return {
        styles: [],
        error: new Error('Invalid query configuration'),
      }
    }

    const { data, error } = await query

    if (error) {
      return {
        styles: [],
        error: error as Error,
      }
    }

    // Refresh signed URLs for reference images (private bucket)
    // Cast data to the shape we selected, then map null -> undefined for reference_images
    const rawData = (data || []) as Array<{
      id: string
      name: string
      description: string | null
      prompt: string | null
      reference_images: string[] | null
      preview_thumbnail_url: string | null
      is_default: boolean
      is_public: boolean
      user_id: string
      created_at: string
    }>
    const stylesData = rawData.map((style) => ({
      ...style,
      reference_images: style.reference_images ?? undefined,
    }))
    const stylesWithUrls = await refreshStyleUrls(supabase, stylesData, user.id)

    return {
      styles: stylesWithUrls as DbStyle[],
      error: null,
    }
  } catch (error) {
    return {
      styles: [],
      error: error instanceof Error ? error : new Error('Failed to fetch styles'),
    }
  }
}

/**
 * Fetch public styles only
 */
export async function fetchPublicStyles(): Promise<FetchPublicStylesResult> {
  try {
    const supabase = await createClient()
    // No auth required - public_styles view is accessible to anonymous users

    const { data, error } = await supabase
      .from('public_styles')
      .select('id,name,description,preview_thumbnail_url')

    if (error) {
      return {
        styles: [],
        error: error as Error,
      }
    }

    return {
      styles: (data || []) as PublicStyle[],
      error: null,
    }
  } catch (error) {
    return {
      styles: [],
      error: error instanceof Error ? error : new Error('Failed to fetch public styles'),
    }
  }
}

/**
 * Fetch public styles without requiring authentication (for landing page)
 * Returns empty array if access is denied by RLS
 */
export async function fetchPublicStylesNoAuth(limit: number = 12): Promise<FetchPublicStylesResult> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('public_styles')
      .select('id,name,description,preview_thumbnail_url')
      .limit(limit)

    if (error) {
      // If RLS blocks access, return empty array (not an error)
      return {
        styles: [],
        error: null,
      }
    }

    return {
      styles: (data || []) as PublicStyle[],
      error: null,
    }
  } catch (error) {
    return {
      styles: [],
      error: null, // Don't treat as error for landing page
    }
  }
}