/**
 * Thumbnails API Route
 * 
 * Handles GET (list) and POST (create) operations for thumbnails.
 * All operations are server-side only for security.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshThumbnailUrls } from '@/lib/server/utils/url-refresh'
import {
  validationErrorResponse,
  databaseErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError, parseQueryParams } from '@/lib/server/utils/api-helpers'
import { createCachedResponse } from '@/lib/server/utils/cache-headers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { ThumbnailInsert } from '@/lib/types/database'
import { buildThumbnailsQuery } from '@/lib/server/data/thumbnails'
import { applyCursorPagination } from '@/lib/server/utils/query-builder'

// Cache GET responses for 60 seconds
// POST requests remain dynamic (not cached)
export const revalidate = 60

/**
 * GET /api/thumbnails
 * List thumbnails for the authenticated user
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const {
      limit,
      cursor,
      orderBy,
      orderDirection,
    } = parseQueryParams(request, {
      defaultLimit: 24,
      maxLimit: 100,
      defaultOrderBy: 'created_at',
      defaultOrderDirection: 'desc',
      allowedOrderBy: ['created_at', 'title', 'share_click_count'],
    })
    const favoritesOnly = searchParams.get('favoritesOnly') === 'true'
    const projectId = searchParams.get('projectId') || null
    const resolvedOrderBy = orderBy as 'created_at' | 'title' | 'share_click_count'
    const resolvedOrderDirection = orderDirection as 'asc' | 'desc'

    // Build query using shared builder
    let query = buildThumbnailsQuery(supabase, user, {
      favoritesOnly,
      orderBy: resolvedOrderBy,
      orderDirection: resolvedOrderDirection,
      projectId: projectId || undefined,
    })

    // Apply cursor-based pagination using utility function
    query = applyCursorPagination(query, {
      limit: limit + 1, // Fetch one extra to determine if there's a next page
      cursor: cursor || null,
      orderBy: resolvedOrderBy,
      orderDirection: resolvedOrderDirection,
      cursorColumn: 'id', // Use id as cursor for tie-breaking when orderBy is not created_at
    })

    const { data, count, error } = await query

    if (error) {
      logError(error, {
        route: 'GET /api/thumbnails',
        userId: user.id,
        operation: 'fetch-thumbnails',
      })
      return databaseErrorResponse('Failed to fetch thumbnails')
    }
    
    // Check if there's a next page (we fetched limit + 1)
    const hasNextPage = data && data.length > limit
    const thumbnails = hasNextPage ? data.slice(0, limit) : (data || [])
    
    // Get cursor for next page (use created_at of last item, or id as fallback)
    const nextCursor = thumbnails.length > 0 
      ? (resolvedOrderBy === 'created_at' 
          ? thumbnails[thumbnails.length - 1].created_at 
          : thumbnails[thumbnails.length - 1].id)
      : null

    // Refresh signed URLs for all thumbnails
    const thumbnailsWithUrls = await refreshThumbnailUrls(
      supabase,
      thumbnails,
      user.id
    )

    const responseData = {
      thumbnails: thumbnailsWithUrls,
      count: count || 0,
      nextCursor: hasNextPage ? nextCursor : null,
      hasNextPage: !!hasNextPage,
    }

    // Cache as private dynamic data so list updates after move/add-to-project
    return createCachedResponse(
      responseData,
      { strategy: 'private-dynamic', maxAge: 60 },
      request
    )
  } catch (error) {
    return handleApiError(error, 'GET /api/thumbnails', 'fetch-thumbnails', undefined, 'Failed to fetch thumbnails')
  }
}

/**
 * POST /api/thumbnails
 * Create a new thumbnail record
 * Note: Actual thumbnail generation should use /api/generate
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body: ThumbnailInsert = await request.json()
    
    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return validationErrorResponse('Title is required')
    }

    if (!body.image_url || !body.image_url.trim()) {
      return validationErrorResponse('Image URL is required')
    }

    // Ensure user_id matches authenticated user
    const thumbnailData: ThumbnailInsert = {
      ...body,
      user_id: user.id, // Override any user_id in body for security
    }

    // Create thumbnail record
    const { data: thumbnail, error: insertError } = await supabase
      .from('thumbnails')
      .insert(thumbnailData)
      .select()
      .single()

    if (insertError) {
      logError(insertError, {
        route: 'POST /api/thumbnails',
        userId: user.id,
        operation: 'create-thumbnail',
      })
      return databaseErrorResponse('Failed to create thumbnail')
    }

    return NextResponse.json({ thumbnail }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'POST /api/thumbnails', 'create-thumbnail', undefined, 'Failed to create thumbnail')
  }
}
