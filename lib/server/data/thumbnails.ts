/**
 * Server-Side Thumbnails Data Fetching
 * 
 * Fetches thumbnail data server-side for SSR.
 * Reuses logic from app/api/thumbnails/route.ts
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshThumbnailUrls, SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS } from '@/lib/server/utils/url-refresh'
import type { DbThumbnail, PublicThumbnailData } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { QueryPatterns } from '@/lib/server/utils/query-builder'

export interface BuildThumbnailsQueryOptions {
  favoritesOnly?: boolean
  orderBy?: 'created_at' | 'title' | 'share_click_count'
  orderDirection?: 'asc' | 'desc'
  /** When set, filter thumbnails by this project. Omit or null = All thumbnails */
  projectId?: string | null
}

export interface FetchThumbnailsOptions {
  limit?: number
  offset?: number
  orderBy?: 'created_at' | 'title' | 'share_click_count'
  orderDirection?: 'asc' | 'desc'
  favoritesOnly?: boolean
  projectId?: string | null
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
const THUMBNAIL_FIELDS = 'id,title,image_url,liked,is_public,created_at,resolution,user_id,style,palette,emotion,aspect_ratio,has_watermark,share_click_count,project_id'

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
    projectId,
  } = options

  // When viewing a specific project: filter by project_id only; RLS allows rows where user is owner or editor.
  if (projectId != null && projectId !== '' && projectId !== '__none__') {
    let query = supabase
      .from('thumbnails')
      .select(THUMBNAIL_FIELDS, { count: 'exact' })
      .eq('project_id', projectId)
      .order(orderBy, { ascending: orderDirection === 'asc' })
    if (favoritesOnly) {
      query = query.eq('liked', true) as ReturnType<SupabaseClient['from']>['select']
    }
    return query
  }

  let query = QueryPatterns.userOwnedWithFavorites(
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

  if (projectId === '__none__') {
    query = query.is('project_id', null) as ReturnType<SupabaseClient['from']>['select']
  }

  return query
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
      projectId,
    } = options

    // Build query using shared builder, then apply offset pagination
    const query = buildThumbnailsQuery(supabase, user, {
      favoritesOnly,
      orderBy,
      orderDirection,
      projectId,
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
      .select('id,title,image_url,style,palette,liked,created_at,resolution,user_id,aspect_ratio', { count: 'exact' })
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
      aspect_ratio: (thumb as { aspect_ratio?: string | null }).aspect_ratio ?? null,
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

/**
 * Fetch thumbnails for a shared project (no auth). Used by GET /api/projects/share/[slug].
 * Uses service client; filters by project_id and optionally liked (favorites only).
 */
export interface FetchSharedProjectThumbnailsOptions {
  projectId: string
  shareMode: 'all' | 'favorites'
  limit?: number
  offset?: number
}

export async function fetchThumbnailsForSharedProject(
  options: FetchSharedProjectThumbnailsOptions
): Promise<FetchPublicThumbnailsResult> {
  const { projectId, shareMode, limit = 100, offset = 0 } = options
  try {
    const supabase = createServiceClient()

    let query = supabase
      .from('thumbnails')
      .select('id,title,image_url,style,palette,liked,created_at,resolution,user_id,share_click_count,aspect_ratio', { count: 'exact' })
      .eq('project_id', projectId)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })

    if (shareMode === 'favorites') {
      query = query.eq('liked', true)
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1)

    if (error) {
      return { thumbnails: [], count: 0, error: error as Error }
    }

    if (!data || data.length === 0) {
      return { thumbnails: [], count: count ?? 0, error: null }
    }

    const ONE_DAY_MS = 24 * 60 * 60 * 1000
    const checkUrlExpiry = (url: string | null): boolean => {
      if (!url) return true
      try {
        const urlObj = new URL(url)
        const expiresParam = urlObj.searchParams.get('expires')
        if (!expiresParam) return true
        const expiresTimestamp = parseInt(expiresParam, 10)
        if (isNaN(expiresTimestamp)) return true
        return expiresTimestamp * 1000 <= Date.now() + ONE_DAY_MS
      } catch {
        return true
      }
    }

    const thumbnailsNeedingRefresh: typeof data = []
    const thumbnailsWithValidUrls: typeof data = []
    data.forEach((thumb) => {
      if (checkUrlExpiry(thumb.image_url)) {
        thumbnailsNeedingRefresh.push(thumb)
      } else {
        thumbnailsWithValidUrls.push(thumb)
      }
    })

    let refreshedThumbnails: typeof data = []
    if (thumbnailsNeedingRefresh.length > 0) {
      const byUserId = new Map<string, typeof data>()
      thumbnailsNeedingRefresh.forEach((thumb) => {
        if (!byUserId.has(thumb.user_id)) byUserId.set(thumb.user_id, [])
        byUserId.get(thumb.user_id)!.push(thumb)
      })
      const arrays = await Promise.all(
        Array.from(byUserId.entries()).map(([userId, thumbs]) =>
          refreshThumbnailUrls(supabase, thumbs, userId)
        )
      )
      refreshedThumbnails = arrays.flat()
    }

    const thumbnailsWithUrls = [...thumbnailsWithValidUrls, ...refreshedThumbnails]
    const publicThumbnails: PublicThumbnailData[] = thumbnailsWithUrls.map((thumb) => ({
      id: thumb.id,
      title: thumb.title,
      image_url: thumb.image_url,
      thumbnail_400w_url: null,
      thumbnail_800w_url: null,
      style: thumb.style,
      palette: thumb.palette,
      liked: thumb.liked,
      created_at: thumb.created_at,
      resolution: thumb.resolution,
      share_click_count: (thumb as { share_click_count?: number }).share_click_count ?? 0,
      aspect_ratio: (thumb as { aspect_ratio?: string | null }).aspect_ratio ?? null,
    }))

    return { thumbnails: publicThumbnails, count: count ?? 0, error: null }
  } catch (err) {
    return {
      thumbnails: [],
      count: 0,
      error: err instanceof Error ? err : new Error('Failed to fetch shared project thumbnails'),
    }
  }
}

/**
 * Get a signed image URL for a thumbnail owned by the user.
 * Used by the agent apply_thumbnail_to_video tool to resolve thumbnail_id to a fetchable URL.
 */
export async function getThumbnailImageUrlForUser(
  userId: string,
  thumbnailId: string
): Promise<{ imageUrl: string | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data: thumbnail, error } = await supabase
    .from('thumbnails')
    .select('id, image_url')
    .eq('id', thumbnailId)
    .eq('user_id', userId)
    .single()

  if (error || !thumbnail) {
    return { imageUrl: null, error: 'Thumbnail not found or access denied' }
  }

  let storagePath: string | null = null
  if (thumbnail.image_url) {
    const signedUrlMatch = (thumbnail.image_url as string).match(
      /\/storage\/v1\/object\/sign\/thumbnails\/([^?]+)/
    )
    if (signedUrlMatch) storagePath = signedUrlMatch[1]
  }
  if (!storagePath) {
    storagePath = `${userId}/${thumbnail.id}/thumbnail.png`
  }

  const { data: signedUrlData } = await supabase.storage
    .from('thumbnails')
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS)

  const url = signedUrlData?.signedUrl ?? null
  if (url) return { imageUrl: url, error: null }

  if (storagePath.endsWith('.png')) {
    const jpgPath = storagePath.replace('.png', '.jpg')
    const { data: jpgData } = await supabase.storage
      .from('thumbnails')
      .createSignedUrl(jpgPath, SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS)
    if (jpgData?.signedUrl) return { imageUrl: jpgData.signedUrl, error: null }
  }

  return { imageUrl: null, error: 'Could not generate thumbnail URL' }
}