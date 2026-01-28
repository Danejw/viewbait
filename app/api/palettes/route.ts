/**
 * Palettes API Route
 * 
 * Handles GET (list) and POST (create) operations for palettes.
 * All operations are server-side only for security.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import type { PaletteInsert } from '@/lib/types/database'
import { createCachedResponse } from '@/lib/server/utils/cache-headers'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { buildPalettesQuery } from '@/lib/server/data/palettes'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'

// Cache GET responses for 60 seconds (ISR)
// POST requests remain dynamic (not cached)
export const revalidate = 60

/**
 * GET /api/palettes
 * List palettes accessible to the authenticated user (own + defaults + public)
 * Query params: ?userOnly=true (only user's palettes), ?publicOnly=true (only public), ?defaultsOnly=true (only defaults)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const userOnly = searchParams.get('userOnly') === 'true'
    const publicOnly = searchParams.get('publicOnly') === 'true'
    const defaultsOnly = searchParams.get('defaultsOnly') === 'true'

    // Handle publicOnly as a special case (uses different view)
    if (publicOnly) {
      // Only public palettes (use view) - select only needed fields, cache as public semi-static
      const { data, error } = await supabase
        .from('public_palettes')
        .select('id,name,colors,is_default,is_public,created_at')
        .order('created_at', { ascending: false })

      if (error) {
        logError(error, {
          route: 'GET /api/palettes',
          userId: user.id,
          operation: 'fetch-public-palettes',
        })
        return databaseErrorResponse('Failed to fetch palettes')
      }

      // Fetch favorite counts for all palettes in a single query
      // Use service role client to bypass RLS for counting (public operation)
      const paletteIds = (data || []).map(p => p.id)
      let favoriteCounts = new Map<string, number>()
      
      if (paletteIds.length > 0) {
        const serviceClient = createServiceClient()
        const { data: favoritesData, error: favoritesError } = await serviceClient
          .from('favorites')
          .select('item_id')
          .eq('item_type', 'palette')
          .in('item_id', paletteIds)

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

      // Merge favorite counts into palettes
      const palettesWithCounts = (data || []).map(palette => ({
        ...palette,
        like_count: favoriteCounts.get(palette.id) || 0,
      }))

      return createCachedResponse(
        { palettes: palettesWithCounts },
        { strategy: 'public-semi-static', maxAge: 3600 },
        request
      )
    }

    // Build query using shared builder
    const query = buildPalettesQuery(supabase, user, {
      userOnly,
      publicOnly: false, // Already handled above
      defaultsOnly,
    })

    if (!query) {
      return validationErrorResponse('Invalid query configuration')
    }

    const { data, error } = await query

    if (error) {
      logError(error, {
        route: 'GET /api/palettes',
        userId: user.id,
        operation: 'fetch-palettes',
      })
      return databaseErrorResponse('Failed to fetch palettes')
    }

    // Determine cache strategy based on query type
    const cacheStrategy = defaultsOnly 
      ? 'public-static'  // Default palettes are static
      : 'private-user';  // User's own palettes are private

    return createCachedResponse(
      { palettes: data || [] },
      { strategy: cacheStrategy, maxAge: defaultsOnly ? 3600 : 300 },
      request
    )
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to fetch palettes', {
      route: 'GET /api/palettes',
      userId,
    })
  }
}

/**
 * POST /api/palettes
 * Create a new palette
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body: PaletteInsert = await request.json()
    
    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return validationErrorResponse('Name is required')
    }

    if (!body.colors || !Array.isArray(body.colors) || body.colors.length === 0) {
      return validationErrorResponse('Colors array is required and cannot be empty')
    }

    // Ensure user_id matches authenticated user and set defaults
    const paletteData: PaletteInsert = {
      ...body,
      user_id: user.id, // Override any user_id in body for security
      is_default: false, // Users cannot create default palettes
      colors: body.colors, // Ensure colors array is provided
    }

    // Create palette record
    const { data: palette, error: insertError } = await supabase
      .from('palettes')
      .insert(paletteData)
      .select()
      .single()

    if (insertError) {
      logError(insertError, {
        route: 'POST /api/palettes',
        userId: user.id,
        operation: 'create-palette',
      })
      return databaseErrorResponse('Failed to create palette')
    }

    return NextResponse.json({ palette }, { status: 201 })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to create palette', {
      route: 'POST /api/palettes',
    })
  }
}

