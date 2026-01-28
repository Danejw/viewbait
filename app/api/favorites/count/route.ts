/**
 * Favorites Count API Route
 * 
 * Handles GET operation to get the favorite count for an item.
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
 * GET /api/favorites/count
 * Get favorite count for an item (public endpoint)
 * Query params: ?itemId=string&itemType=style|palette|thumbnail
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const itemType = searchParams.get('itemType') as FavoriteItemType | null

    // Validate required query params
    if (!itemId || !itemId.trim()) {
      return validationErrorResponse('itemId query parameter is required')
    }

    if (!itemType || !['style', 'palette', 'thumbnail'].includes(itemType)) {
      return validationErrorResponse('itemType query parameter is required and must be one of: style, palette, thumbnail')
    }

    // Get count (public - no user filter)
    const { count, error } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('item_id', itemId.trim())
      .eq('item_type', itemType)

    if (error) {
      logError(error, {
        route: 'GET /api/favorites/count',
        operation: 'count-favorites',
        itemId: itemId.trim(),
        itemType,
      })
      return databaseErrorResponse('Failed to get favorite count')
    }

    return NextResponse.json({
      count: count || 0,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to get favorite count', {
      route: 'GET /api/favorites/count',
    })
  }
}
