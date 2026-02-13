/**
 * Thumbnails Search API Route
 * 
 * Handles server-side search for thumbnails by title.
 * Uses PostgreSQL ILIKE for case-insensitive search.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshThumbnailUrls } from '@/lib/server/utils/url-refresh'
import {
  validationErrorResponse,
  databaseErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError, parseQueryParams } from '@/lib/server/utils/api-helpers'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'

/**
 * GET /api/thumbnails/search
 * Search thumbnails by title
 * Query params: ?q=searchTerm&limit=20&offset=0
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const { limit, offset } = parseQueryParams(request, {
      defaultLimit: 20,
      maxLimit: 100,
      defaultOffset: 0,
    })

    if (!query || !query.trim()) {
      return validationErrorResponse('Search query is required')
    }

    // Build search query using ILIKE for case-insensitive search
    const { data, count, error } = await supabase
      .from('thumbnails')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .ilike('title', `%${query.trim()}%`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      logError(error, {
        route: 'GET /api/thumbnails/search',
        userId: user.id,
        operation: 'search-thumbnails',
      })
      return databaseErrorResponse('Failed to search thumbnails')
    }

    // Refresh signed URLs for all thumbnails
    const thumbnailsWithUrls = await refreshThumbnailUrls(
      supabase,
      data || [],
      user.id
    )

    return NextResponse.json({
      thumbnails: thumbnailsWithUrls,
      count: count || 0,
    })
  } catch (error) {
    return handleApiError(error, 'GET /api/thumbnails/search', 'search-thumbnails', undefined, 'Failed to search thumbnails')
  }
}

