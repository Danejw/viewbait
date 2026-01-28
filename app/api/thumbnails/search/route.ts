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
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
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
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

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
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to search thumbnails')
  }
}

