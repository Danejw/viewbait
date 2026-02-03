/**
 * Favorites Check API Route
 * 
 * Handles GET operation to check if an item is favorited by the authenticated user.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse ,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

type FavoriteItemType = 'style' | 'palette' | 'thumbnail'

/**
 * GET /api/favorites/check
 * Check if an item is favorited by the authenticated user
 * Query params: ?itemId=string&itemType=style|palette|thumbnail
 */
export async function GET(request: Request) {
  let userId: string | undefined

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    userId = user.id

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

    // Check if favorite exists
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', itemId.trim())
      .eq('item_type', itemType)
      .maybeSingle()

    if (error) {
      logError(error, {
        route: 'GET /api/favorites/check',
        userId: user.id,
        operation: 'check-favorite',
        itemId: itemId.trim(),
        itemType,
      })
      return databaseErrorResponse('Failed to check favorite status')
    }

    return NextResponse.json({
      favorited: !!data,
    })
  } catch (error) {
    return handleApiError(error, 'GET /api/favorites/check', 'check-favorite-status', undefined, 'Failed to check favorite status')
  }
}
