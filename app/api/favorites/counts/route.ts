/**
 * Favorites Counts Batch API Route
 * 
 * Handles GET operation to get favorite counts for multiple items in a single request.
 * This is a public endpoint (no authentication required) for displaying public favorite counts.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'

type FavoriteItemType = 'style' | 'palette' | 'thumbnail'

/**
 * GET /api/favorites/counts
 * Get favorite counts for multiple items (public endpoint)
 * Query params: ?itemIds=id1,id2,id3&itemType=style|palette|thumbnail
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const itemIdsParam = searchParams.get('itemIds')
    const itemType = searchParams.get('itemType') as FavoriteItemType | null

    // Validate required query params
    if (!itemIdsParam || !itemIdsParam.trim()) {
      return validationErrorResponse('itemIds query parameter is required (comma-separated list)')
    }

    if (!itemType || !['style', 'palette', 'thumbnail'].includes(itemType)) {
      return validationErrorResponse('itemType query parameter is required and must be one of: style, palette, thumbnail')
    }

    // Parse itemIds (comma-separated)
    const itemIds = itemIdsParam
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)

    if (itemIds.length === 0) {
      return validationErrorResponse('At least one itemId is required')
    }

    // Limit batch size to prevent abuse (max 100 items per request)
    if (itemIds.length > 100) {
      return validationErrorResponse('Maximum 100 itemIds allowed per request')
    }

    // Get counts for all items in a single query
    // Use .in() to filter by multiple item_ids
    const { data, error } = await supabase
      .from('favorites')
      .select('item_id')
      .eq('item_type', itemType)
      .in('item_id', itemIds)

    if (error) {
      logError(error, {
        route: 'GET /api/favorites/counts',
        operation: 'batch-count-favorites',
        itemType,
        itemCount: itemIds.length,
      })
      return databaseErrorResponse('Failed to get favorite counts')
    }

    // Count occurrences of each item_id
    const counts: Record<string, number> = {}
    
    // Initialize all itemIds with 0
    itemIds.forEach(id => {
      counts[id] = 0
    })

    // Count favorites for each item
    if (data) {
      data.forEach((favorite) => {
        const itemId = favorite.item_id
        if (itemId && counts.hasOwnProperty(itemId)) {
          counts[itemId] = (counts[itemId] || 0) + 1
        }
      })
    }

    return NextResponse.json({
      counts,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to get favorite counts', {
      route: 'GET /api/favorites/counts',
    })
  }
}
