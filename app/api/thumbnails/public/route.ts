/**
 * Public Thumbnails API Route
 * 
 * Handles GET requests for public thumbnails (no authentication required).
 * Supports pagination for infinite scrolling.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { refreshThumbnailUrls } from '@/lib/server/utils/url-refresh'
import {
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { createCachedResponse } from '@/lib/server/utils/cache-headers'
import { parseQueryParams } from '@/lib/server/utils/api-helpers'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'

// Cache GET responses for 60 seconds (ISR)
export const revalidate = 60

/**
 * GET /api/thumbnails/public
 * List public thumbnails (no authentication required)
 * Query params: ?limit=20&offset=0
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Parse query parameters
    const { limit, offset } = parseQueryParams(request, {
      defaultLimit: 20,
      maxLimit: 100,
      defaultOffset: 0,
    })

    // Query public thumbnails - select only needed fields
    // Filter out thumbnails without image_url at the database level if possible
    const { data, count, error } = await supabase
      .from('thumbnails')
      // Note: thumbnail_400w_url and thumbnail_800w_url are optional columns that may not exist yet
      .select('id,title,image_url,liked,is_public,created_at,resolution,user_id,style,palette,emotion,aspect_ratio,has_watermark', { count: 'exact' })
      .eq('is_public', true)
      .not('image_url', 'is', null) // Filter out null image_url
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      logError(error, {
        route: 'GET /api/thumbnails/public',
        operation: 'fetch-public-thumbnails',
      })
      // Return empty array instead of error for public endpoint
      const emptyResponse = {
        thumbnails: [],
        count: 0,
      }
      return createCachedResponse(
        emptyResponse,
        { strategy: 'public-semi-static', maxAge: 60 }, // Shorter cache for errors
        request
      )
    }

    if (!data || data.length === 0) {
      const emptyResponse = {
        thumbnails: [],
        count: count || 0,
      }
      return createCachedResponse(
        emptyResponse,
        { strategy: 'public-semi-static', maxAge: 3600 },
        request
      )
    }

    // Refresh signed URLs for all thumbnails in batches by user_id
    // Group by user_id to batch URL refreshes more efficiently
    const thumbnailsByUserId = new Map<string, typeof data>()
    data.forEach(thumb => {
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
    const thumbnailsWithUrls = thumbnailsWithUrlsArrays.flat()

    // Fetch favorite counts for all thumbnails in a single query
    // Use service role client to bypass RLS for counting (public operation)
    const thumbnailIds = thumbnailsWithUrls.map(t => t.id)
    let favoriteCounts = new Map<string, number>()
    
    if (thumbnailIds.length > 0) {
      const serviceClient = createServiceClient()
      const { data: favoritesData, error: favoritesError } = await serviceClient
        .from('favorites')
        .select('item_id')
        .eq('item_type', 'thumbnail')
        .in('item_id', thumbnailIds)

      if (!favoritesError && favoritesData) {
        // Count occurrences of each item_id
        favoritesData.forEach((favorite) => {
          const itemId = favorite.item_id
          if (itemId) {
            favoriteCounts.set(itemId, (favoriteCounts.get(itemId) || 0) + 1)
          }
        })
      }
    }

    // Merge favorite counts into thumbnails
    const thumbnailsWithCounts = thumbnailsWithUrls.map(thumb => ({
      ...thumb,
      like_count: favoriteCounts.get(thumb.id) || 0,
    }))

    const responseData = {
      thumbnails: thumbnailsWithCounts,
      count: count || 0,
    }

    // Return cached response with ETag support
    return createCachedResponse(
      responseData,
      { strategy: 'public-semi-static', maxAge: 3600 },
      request
    )
  } catch (error) {
    logError(error, {
      route: 'GET /api/thumbnails/public',
      operation: 'fetch-public-thumbnails',
    })
    // Return empty array instead of error for public endpoint
    const emptyResponse = {
      thumbnails: [],
      count: 0,
    }
    return createCachedResponse(
      emptyResponse,
      { strategy: 'public-semi-static', maxAge: 60 }, // Shorter cache for errors
      request
    )
  }
}
