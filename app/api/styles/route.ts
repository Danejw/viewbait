/**
 * Styles API Route
 * 
 * Handles GET (list) and POST (create) operations for styles.
 * All operations are server-side only for security.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshStyleUrls } from '@/lib/server/utils/url-refresh'
import {
  validationErrorResponse,
  databaseErrorResponse,
  tierLimitResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { getTierForUser } from '@/lib/server/utils/tier'
import { VALIDATION_NAME_REQUIRED } from '@/lib/constants/validation-messages'
import { createCachedResponse, addCacheHeaders } from '@/lib/server/utils/cache-headers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { StyleInsert } from '@/lib/types/database'
import { buildStylesQuery } from '@/lib/server/data/styles'

// Cache GET responses for 60 seconds (ISR)
// POST requests remain dynamic (not cached)
export const revalidate = 60

/**
 * GET /api/styles
 * List styles accessible to the authenticated user (own + defaults + public)
 * Query params: ?userOnly=true (only user's styles), ?publicOnly=true (only public), ?defaultsOnly=true (only defaults)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const userOnly = searchParams.get('userOnly') === 'true'
    const publicOnly = searchParams.get('publicOnly') === 'true'
    const defaultsOnly = searchParams.get('defaultsOnly') === 'true'

    // Handle publicOnly as a special case (uses different view, no auth required)
    if (publicOnly) {
      // Only public styles (use view) - select only public fields, cache as public semi-static
      // No auth required - public_styles view is accessible to anonymous users
      const { data, error } = await supabase
        .from('public_styles')
        .select('id,name,description,preview_thumbnail_url')

      if (error) {
        logError(error, {
          route: 'GET /api/styles',
          operation: 'fetch-public-styles',
        })
        return databaseErrorResponse('Failed to fetch styles')
      }

      // Fetch favorite counts for all styles in a single query
      // Use service role client to bypass RLS for counting (public operation)
      const styleIds = (data || []).map(s => s.id)
      let favoriteCounts = new Map<string, number>()
      
      if (styleIds.length > 0) {
        const serviceClient = createServiceClient()
        const { data: favoritesData, error: favoritesError } = await serviceClient
          .from('favorites')
          .select('item_id')
          .eq('item_type', 'style')
          .in('item_id', styleIds)

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

      // Merge favorite counts into styles
      const stylesWithCounts = (data || []).map(style => ({
        ...style,
        like_count: favoriteCounts.get(style.id) || 0,
      }))

      return createCachedResponse(
        { styles: stylesWithCounts },
        { strategy: 'public-semi-static', maxAge: 3600 },
        request
      )
    }

    // For other queries, require authentication
    const user = await requireAuth(supabase)

    // Build query using shared builder
    const query = buildStylesQuery(supabase, user, {
      userOnly,
      publicOnly: false, // Already handled above
      defaultsOnly,
    })

    if (!query) {
      return databaseErrorResponse('Invalid query configuration')
    }

    const { data, error } = await query

    if (error) {
      logError(error, {
        route: 'GET /api/styles',
        userId: user.id,
        operation: 'fetch-styles',
      })
      return databaseErrorResponse('Failed to fetch styles')
    }

    // Refresh signed URLs for reference images (private bucket)
    // Cast query result to shape with id + reference_images; normalize null -> undefined
    const rawStyles = (data || []) as Array<{ id: string; reference_images?: string[] | null }>
    const stylesForRefresh = rawStyles.map((s) => ({
      ...s,
      reference_images: s.reference_images ?? undefined,
    }))
    const stylesWithUrls = await refreshStyleUrls(supabase, stylesForRefresh, user.id)

    // Determine cache strategy based on query type
    const cacheStrategy = defaultsOnly 
      ? 'public-static'  // Default styles are static
      : 'private-user';  // User's own styles are private

    return createCachedResponse(
      { styles: stylesWithUrls },
      { strategy: cacheStrategy, maxAge: defaultsOnly ? 3600 : 300 },
      request
    )
  } catch (error) {
    return handleApiError(error, 'GET /api/styles', 'fetch-styles', undefined, 'Failed to fetch styles')
  }
}

/**
 * POST /api/styles
 * Create a new style
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tier = await getTierForUser(supabase, user.id)
    if (!tier.can_create_custom) {
      return tierLimitResponse('Custom styles, palettes, and faces require Starter or higher.')
    }

    // Parse request body
    const body: StyleInsert = await request.json()
    
    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return validationErrorResponse(VALIDATION_NAME_REQUIRED)
    }

    // Ensure user_id matches authenticated user and set defaults
    const styleData: StyleInsert = {
      ...body,
      user_id: user.id, // Override any user_id in body for security
      is_default: false, // Users cannot create default styles
      reference_images: body.reference_images || [],
      colors: body.colors || [],
    }

    // Create style record
    const { data: style, error: insertError } = await supabase
      .from('styles')
      .insert(styleData)
      .select()
      .single()

    if (insertError) {
      logError(insertError, {
        route: 'POST /api/styles',
        userId: user.id,
        operation: 'create-style',
      })
      return databaseErrorResponse('Failed to create style')
    }

    return NextResponse.json({ style }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'POST /api/styles', 'create-style', undefined, 'Failed to create style')
  }
}

