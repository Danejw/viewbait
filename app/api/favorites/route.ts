/**
 * Favorites API Route
 * 
 * Handles GET (list), POST (create), and DELETE (remove) operations for favorites.
 * All operations are server-side only for security and RLS enforcement.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import type { Favorite, FavoriteInsert } from '@/lib/types/database'

type FavoriteItemType = 'style' | 'palette' | 'thumbnail'

/**
 * GET /api/favorites
 * List favorites for the authenticated user
 * Query params: ?itemType=style|palette|thumbnail (optional), ?limit=number (optional), ?offset=number (optional)
 */
export async function GET(request: Request) {
  let userId: string | undefined

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    userId = user.id

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const itemType = searchParams.get('itemType') as FavoriteItemType | null
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Validate itemType if provided
    if (itemType && !['style', 'palette', 'thumbnail'].includes(itemType)) {
      return validationErrorResponse(
        `Invalid itemType: "${itemType}". Must be one of: style, palette, thumbnail`
      )
    }

    // Build query
    let query = supabase
      .from('favorites')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply itemType filter if provided
    if (itemType) {
      query = query.eq('item_type', itemType)
    }

    const { data, count, error } = await query

    if (error) {
      logError(error, {
        route: 'GET /api/favorites',
        userId: user.id,
        operation: 'fetch-favorites',
      })
      return databaseErrorResponse('Failed to fetch favorites')
    }

    return NextResponse.json({
      favorites: data || [],
      count: count || 0,
    })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to fetch favorites', {
      route: 'GET /api/favorites',
      userId,
    })
  }
}

/**
 * POST /api/favorites
 * Add a favorite
 * Request body: { itemId: string, itemType: 'style' | 'palette' | 'thumbnail' }
 */
export async function POST(request: Request) {
  let userId: string | undefined

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    userId = user.id

    // Parse request body
    const body: { itemId: string; itemType: FavoriteItemType } = await request.json()

    // Validate required fields
    if (!body.itemId || !body.itemId.trim()) {
      return validationErrorResponse('itemId is required')
    }

    if (!body.itemType || !['style', 'palette', 'thumbnail'].includes(body.itemType)) {
      const receivedValue = body.itemType ? `"${body.itemType}"` : 'missing'
      return validationErrorResponse(
        `itemType is required and must be one of: style, palette, thumbnail. Received: ${receivedValue}`
      )
    }

    // Prepare favorite data
    const favoriteData: FavoriteInsert = {
      user_id: user.id, // Always use authenticated user's ID
      item_id: body.itemId.trim(),
      item_type: body.itemType,
    }

    // Insert favorite (handle duplicate gracefully)
    const { data: favorite, error: insertError } = await supabase
      .from('favorites')
      .insert(favoriteData)
      .select()
      .single()

    if (insertError) {
      // Check if it's a unique constraint violation (duplicate favorite)
      if (insertError.code === '23505' || insertError.message.includes('duplicate')) {
        // Try to fetch the existing favorite
        const { data: existing } = await supabase
          .from('favorites')
          .select()
          .eq('user_id', user.id)
          .eq('item_id', body.itemId.trim())
          .eq('item_type', body.itemType)
          .single()

        if (existing) {
          // Return existing favorite (idempotent operation)
          return NextResponse.json({ favorite: existing }, { status: 200 })
        }
      }

      logError(insertError, {
        route: 'POST /api/favorites',
        userId: user.id,
        operation: 'create-favorite',
        itemId: body.itemId,
        itemType: body.itemType,
      })
      return databaseErrorResponse('Failed to create favorite')
    }

    return NextResponse.json({ favorite }, { status: 201 })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to create favorite', {
      route: 'POST /api/favorites',
      userId,
    })
  }
}

/**
 * DELETE /api/favorites
 * Remove a favorite
 * Query params: ?itemId=string&itemType=style|palette|thumbnail
 */
export async function DELETE(request: Request) {
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
      const receivedValue = itemType ? `"${itemType}"` : 'missing'
      return validationErrorResponse(
        `itemType query parameter is required and must be one of: style, palette, thumbnail. Received: ${receivedValue}`
      )
    }

    // Delete favorite (only user's own)
    const { error: deleteError } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('item_id', itemId.trim())
      .eq('item_type', itemType)

    if (deleteError) {
      logError(deleteError, {
        route: 'DELETE /api/favorites',
        userId: user.id,
        operation: 'delete-favorite',
        itemId: itemId.trim(),
        itemType,
      })
      return databaseErrorResponse('Failed to delete favorite')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to delete favorite', {
      route: 'DELETE /api/favorites',
      userId,
    })
  }
}
