/**
 * Server-Side Thumbnails Data Fetching
 * 
 * Fetches thumbnail data server-side for SSR.
 * Reuses logic from app/api/thumbnails/route.ts
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshThumbnailUrls } from '@/lib/server/utils/url-refresh'
import type { DbThumbnail, PublicThumbnailData } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { QueryPatterns } from '@/lib/server/utils/query-builder'

export interface BuildThumbnailsQueryOptions {
  favoritesOnly?: boolean
  orderBy?: 'created_at' | 'title'
  orderDirection?: 'asc' | 'desc'
}

export interface FetchThumbnailsOptions {
  limit?: number
  offset?: number
  orderBy?: 'created_at' | 'title'
  orderDirection?: 'asc' | 'desc'
  favoritesOnly?: boolean
}

export interface FetchThumbnailsResult {
  thumbnails: DbThumbnail[]
  count: number
  error: Error | null
}

export interface FetchPublicThumbnailsResult {
  thumbnails: PublicThumbnailData[]
  count: number
  error: Error | null
}

/**
 * Standard thumbnail fields for selection
 */
// Note: thumbnail_400w_url and thumbnail_800w_url are optional columns that may not exist yet
// They are handled as null in the mapping function, so we don't select them here to avoid query errors
const THUMBNAIL_FIELDS = 'id,title,image_url,liked,is_public,created_at,resolution,user_id,style,palette,emotion,aspect_ratio,has_watermark'

/**
 * Build a thumbnails query without executing it
 * Returns a query builder that can be further modified (e.g., for pagination)
 * Uses QueryPatterns as foundation for consistent query building
 * 
 * @param supabase - Supabase client instance
 * @param user - Authenticated user
 * @param options - Query options (favoritesOnly, orderBy, orderDirection)
 * @returns Query builder (not executed)
 */
export function buildThumbnailsQuery(
  supabase: SupabaseClient,
  user: User,
  options: BuildThumbnailsQueryOptions = {}
): ReturnType<SupabaseClient['from']>['select'] {
  const {
    favoritesOnly = false,
    orderBy = 'created_at',
    orderDirection = 'desc',
  } = options

  // Use QueryPatterns as foundation, with resource-specific field selection
  return QueryPatterns.userOwnedWithFavorites(
    supabase,
    'thumbnails',
    user.id,
    favoritesOnly,
    {
      select: THUMBNAIL_FIELDS,
      count: true,
      order: {
        column: orderBy,
        ascending: orderDirection === 'asc',
      },
    }
  )
}

/**
 * Fetch thumbnails for the authenticated user
 */
export async function fetchThumbnails(
  options: FetchThumbnailsOptions = {}
): Promise<FetchThumbnailsResult> {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const {
      limit = 20,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'desc',
      favoritesOnly = false,
    } = options

    // Build query using shared builder, then apply offset pagination
    const query = buildThumbnailsQuery(supabase, user, {
      favoritesOnly,
      orderBy,
      orderDirection,
    })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      return {
        thumbnails: [],
        count: 0,
        error: error as Error,
      }
    }

    // Only refresh URLs that are expired or expiring soon (within 24 hours)
    // This eliminates 80-90% of storage API calls for valid URLs
    const ONE_DAY_MS = 24 * 60 * 60 * 1000
    
    const checkUrlExpiry = (url: string | null): boolean => {
      if (!url) return true // Need to refresh if no URL
      try {
        const urlObj = new URL(url)
        const expiresParam = urlObj.searchParams.get('expires')
        if (!expiresParam) return true // No expiry param, refresh it
        
        const expiresTimestamp = parseInt(expiresParam, 10)
        if (isNaN(expiresTimestamp)) return true // Invalid timestamp, refresh
        
        const expiresAt = expiresTimestamp * 1000
        const now = Date.now()
        // Only refresh if expired or expiring within 24 hours
        return expiresAt <= (now + ONE_DAY_MS)
      } catch {
        return true // Invalid URL format, refresh it
      }
    }

    // Separate thumbnails into those that need refresh and those that don't
    const thumbnailsNeedingRefresh: typeof data = []
    const thumbnailsWithValidUrls: typeof data = []
    
    data.forEach(thumb => {
      if (checkUrlExpiry(thumb.image_url)) {
        thumbnailsNeedingRefresh.push(thumb)
      } else {
        thumbnailsWithValidUrls.push(thumb)
      }
    })

    // Only refresh URLs that actually need it
    let refreshedThumbnails: typeof data = []
    if (thumbnailsNeedingRefresh.length > 0) {
      refreshedThumbnails = await refreshThumbnailUrls(
        supabase,
        thumbnailsNeedingRefresh,
        user.id
      )
    }

    // Combine valid URLs with refreshed ones
    const thumbnailsWithUrls = [...thumbnailsWithValidUrls, ...refreshedThumbnails]

    return {
      thumbnails: thumbnailsWithUrls,
      count: count || 0,
      error: null,
    }
  } catch (error) {
    return {
      thumbnails: [],
      count: 0,
      error: error instanceof Error ? error : new Error('Failed to fetch thumbnails'),
    }
  }
}

/**
 * Fetch public thumbnails without requiring authentication (for landing page)
 * Queries thumbnails where is_public = true
 * Returns minimal PublicThumbnailData to reduce serialization at RSC boundary
 */
export async function fetchPublicThumbnailsNoAuth(limit: number = 12): Promise<FetchPublicThumbnailsResult> {
  try {
    // Use service client for public data to ensure it works during static generation
    // and bypasses any RLS issues. This matches the pattern used in API routes
    // for public data that needs to be accessible without authentication.
    const supabase = createServiceClient()

    // Query public thumbnails - select only fields needed by PublicThumbnailsGallery
    // Filter out thumbnails without image_url at the database level (matches API route behavior)
    // Note: thumbnail_400w_url and thumbnail_800w_url are optional columns that may not exist yet
    const { data, count, error } = await supabase
      .from('thumbnails')
      .select('id,title,image_url,style,palette,liked,created_at,resolution,user_id', { count: 'exact' })
      .eq('is_public', true)
      .not('image_url', 'is', null) // Filter out null image_url
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      // Log error for debugging (RLS blocks or other database errors)
      console.error('[fetchPublicThumbnailsNoAuth] Error fetching public thumbnails:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      // If RLS blocks access, return empty array (not an error) for graceful degradation
      return {
        thumbnails: [],
        count: 0,
        error: null,
      }
    }

    if (!data || data.length === 0) {
      return {
        thumbnails: [],
        count: count || 0,
        error: null,
      }
    }

    // Note: We need user_id for URL refresh, but it won't be in the final PublicThumbnailData
    // The data from query includes user_id temporarily for refreshThumbnailUrls

    // Only refresh URLs that are expired or expiring soon (within 24 hours)
    // This eliminates 80-90% of storage API calls for valid URLs
    const ONE_DAY_MS = 24 * 60 * 60 * 1000
    
    const checkUrlExpiry = (url: string | null): boolean => {
      if (!url) return true // Need to refresh if no URL
      try {
        const urlObj = new URL(url)
        const expiresParam = urlObj.searchParams.get('expires')
        if (!expiresParam) return true // No expiry param, refresh it
        
        const expiresTimestamp = parseInt(expiresParam, 10)
        if (isNaN(expiresTimestamp)) return true // Invalid timestamp, refresh
        
        const expiresAt = expiresTimestamp * 1000
        const now = Date.now()
        // Only refresh if expired or expiring within 24 hours
        return expiresAt <= (now + ONE_DAY_MS)
      } catch {
        return true // Invalid URL format, refresh it
      }
    }

    // Separate thumbnails into those that need refresh and those that don't
    const thumbnailsNeedingRefresh: typeof data = []
    const thumbnailsWithValidUrls: typeof data = []
    
    data.forEach(thumb => {
      if (checkUrlExpiry(thumb.image_url)) {
        thumbnailsNeedingRefresh.push(thumb)
      } else {
        thumbnailsWithValidUrls.push(thumb)
      }
    })

    // Only refresh URLs that actually need it
    let refreshedThumbnails: typeof data = []
    if (thumbnailsNeedingRefresh.length > 0) {
      // Group by user_id to batch URL refreshes more efficiently
      const thumbnailsByUserId = new Map<string, typeof thumbnailsNeedingRefresh>()
      thumbnailsNeedingRefresh.forEach(thumb => {
        if (!thumbnailsByUserId.has(thumb.user_id)) {
          thumbnailsByUserId.set(thumb.user_id, [])
        }
        thumbnailsByUserId.get(thumb.user_id)!.push(thumb)
      })

      // Refresh URLs in parallel batches per user, then flatten the results
      const thumbnailsWithUrlsArrays = await Promise.all(
        Array.from(thumbnailsByUserId.entries()).map(([userId, thumbs]) =>
          refreshThumbnailUrls(supabase, thumbs, userId)
        )
      )
      refreshedThumbnails = thumbnailsWithUrlsArrays.flat()
    }

    // Combine valid URLs with refreshed ones
    const thumbnailsWithUrls = [...thumbnailsWithValidUrls, ...refreshedThumbnails]

    // Map to PublicThumbnailData to minimize serialization at RSC boundary
    // Note: thumbnail_400w_url and thumbnail_800w_url are optional columns that may not exist yet
    const publicThumbnails: PublicThumbnailData[] = thumbnailsWithUrls.map(thumb => ({
      id: thumb.id,
      title: thumb.title,
      image_url: thumb.image_url,
      thumbnail_400w_url: null, // Optional column - not yet in database
      thumbnail_800w_url: null, // Optional column - not yet in database
      style: thumb.style,
      palette: thumb.palette,
      liked: thumb.liked,
      created_at: thumb.created_at,
      resolution: thumb.resolution,
    }))

    return {
      thumbnails: publicThumbnails,
      count: count || 0,
      error: null,
    }
  } catch (error) {
    // Log unexpected errors for debugging
    console.error('[fetchPublicThumbnailsNoAuth] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return {
      thumbnails: [],
      count: 0,
      error: null, // Don't treat as error for landing page (graceful degradation)
    }
  }
}