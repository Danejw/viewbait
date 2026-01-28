/**
 * Favorites Service
 * 
 * Handles favorites/bookmarks for styles, palettes, thumbnails, and faces.
 * Uses API routes for server-side validation and RLS enforcement.
 */

import { apiGet, apiPost, apiDelete } from '@/lib/services/api-client'
import type { Favorite } from '@/lib/types/database'

export type FavoriteItemType = 'style' | 'palette' | 'thumbnail'

const VALID_ITEM_TYPES: FavoriteItemType[] = ['style', 'palette', 'thumbnail']

/**
 * Validate that itemType is a valid FavoriteItemType
 * Returns an error message if invalid, null if valid
 */
function validateItemType(itemType: unknown): Error | null {
  if (!itemType) {
    return new Error('itemType is required')
  }
  
  if (typeof itemType !== 'string') {
    return new Error(`itemType must be a string, received: ${typeof itemType}`)
  }
  
  if (!VALID_ITEM_TYPES.includes(itemType as FavoriteItemType)) {
    return new Error(
      `Invalid itemType: "${itemType}". Must be one of: ${VALID_ITEM_TYPES.join(', ')}`
    )
  }
  
  return null
}

/**
 * Get all favorites for the authenticated user, optionally filtered by type
 */
export async function getFavorites(
  itemType?: FavoriteItemType,
  limit?: number,
  offset?: number
): Promise<{
  favorites: Favorite[]
  error: Error | null
}> {
  // Validate itemType if provided
  if (itemType) {
    const validationError = validateItemType(itemType)
    if (validationError) {
      return {
        favorites: [],
        error: validationError,
      }
    }
  }
  
  // Build URL with query params
  const params = new URLSearchParams()
  if (itemType) {
    params.append('itemType', itemType)
  }
  if (limit !== undefined) {
    params.append('limit', limit.toString())
  }
  if (offset !== undefined) {
    params.append('offset', offset.toString())
  }

  const url = `/api/favorites${params.toString() ? `?${params.toString()}` : ''}`
  const { data, error } = await apiGet<{ favorites: Favorite[]; count: number }>(url)

  return {
    favorites: data?.favorites || [],
    error: error ? new Error(error.message) : null,
  }
}

/**
 * Get favorite IDs for quick lookup
 */
export async function getFavoriteIds(
  itemType?: FavoriteItemType
): Promise<{
  ids: Set<string>
  error: Error | null
}> {
  const { favorites, error } = await getFavorites(itemType)

  return {
    ids: new Set(favorites.map((f) => f.item_id)),
    error,
  }
}

/**
 * Check if an item is favorited
 */
export async function isFavorited(
  itemId: string,
  itemType: FavoriteItemType
): Promise<{
  favorited: boolean
  error: Error | null
}> {
  // Validate itemType
  const validationError = validateItemType(itemType)
  if (validationError) {
    return {
      favorited: false,
      error: validationError,
    }
  }
  
  const params = new URLSearchParams({
    itemId,
    itemType,
  })
  const url = `/api/favorites/check?${params.toString()}`
  const { data, error } = await apiGet<{ favorited: boolean }>(url)

  return {
    favorited: data?.favorited || false,
    error: error ? new Error(error.message) : null,
  }
}

/**
 * Add an item to favorites
 */
export async function addFavorite(
  itemId: string,
  itemType: FavoriteItemType
): Promise<{
  favorite: Favorite | null
  error: Error | null
}> {
  // Validate itemType
  const validationError = validateItemType(itemType)
  if (validationError) {
    return {
      favorite: null,
      error: validationError,
    }
  }
  
  const { data, error } = await apiPost<{ favorite: Favorite }>('/api/favorites', {
    itemId,
    itemType,
  })

  return {
    favorite: data?.favorite || null,
    error: error ? new Error(error.message) : null,
  }
}

/**
 * Remove an item from favorites
 */
export async function removeFavorite(
  itemId: string,
  itemType: FavoriteItemType
): Promise<{
  error: Error | null
}> {
  // Validate itemType
  const validationError = validateItemType(itemType)
  if (validationError) {
    return {
      error: validationError,
    }
  }
  
  const params = new URLSearchParams({
    itemId,
    itemType,
  })
  const url = `/api/favorites?${params.toString()}`
  const { data, error } = await apiDelete<{ success: boolean }>(url)

  return {
    error: error ? new Error(error.message) : null,
  }
}

/**
 * Toggle favorite status for an item
 */
export async function toggleFavorite(
  itemId: string,
  itemType: FavoriteItemType
): Promise<{
  favorited: boolean
  error: Error | null
}> {
  const { favorited, error: checkError } = await isFavorited(itemId, itemType)

  if (checkError) {
    return { favorited: false, error: checkError }
  }

  if (favorited) {
    const { error } = await removeFavorite(itemId, itemType)
    return { favorited: false, error }
  } else {
    const { error } = await addFavorite(itemId, itemType)
    return { favorited: true, error }
  }
}

/**
 * Get favorites count for an item (useful for public items)
 */
export async function getFavoriteCount(
  itemId: string,
  itemType: FavoriteItemType
): Promise<{
  count: number
  error: Error | null
}> {
  // Validate itemType
  const validationError = validateItemType(itemType)
  if (validationError) {
    return {
      count: 0,
      error: validationError,
    }
  }
  
  const params = new URLSearchParams({
    itemId,
    itemType,
  })
  const url = `/api/favorites/count?${params.toString()}`
  const { data, error } = await apiGet<{ count: number }>(url)

  return {
    count: data?.count || 0,
    error: error ? new Error(error.message) : null,
  }
}

/**
 * Get favorite counts for multiple items in a single batch request (optimized)
 */
export async function getFavoriteCounts(
  itemIds: string[],
  itemType: FavoriteItemType
): Promise<{
  counts: Map<string, number>
  error: Error | null
}> {
  // Validate itemType
  const validationError = validateItemType(itemType)
  if (validationError) {
    return {
      counts: new Map(),
      error: validationError,
    }
  }

  if (itemIds.length === 0) {
    return {
      counts: new Map(),
      error: null,
    }
  }

  // Batch items in chunks of 100 (API limit)
  const batchSize = 100
  const batches: string[][] = []
  for (let i = 0; i < itemIds.length; i += batchSize) {
    batches.push(itemIds.slice(i, i + batchSize))
  }

  const allCounts = new Map<string, number>()
  let lastError: Error | null = null

  // Process batches sequentially to avoid overwhelming the server
  for (const batch of batches) {
    try {
      const params = new URLSearchParams({
        itemIds: batch.join(','),
        itemType,
      })
      const url = `/api/favorites/counts?${params.toString()}`
      const { data, error } = await apiGet<{ counts: Record<string, number> }>(url)

      if (error) {
        lastError = new Error(error.message)
        // Continue processing other batches even if one fails
        continue
      }

      // Merge counts into the map
      if (data?.counts) {
        Object.entries(data.counts).forEach(([itemId, count]) => {
          allCounts.set(itemId, count)
        })
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      // Continue processing other batches
    }
  }

  // Initialize missing itemIds with 0
  itemIds.forEach(id => {
    if (!allCounts.has(id)) {
      allCounts.set(id, 0)
    }
  })

  return {
    counts: allCounts,
    error: lastError,
  }
}

/**
 * Get all favorited styles for the authenticated user
 */
export async function getFavoriteStyles(): Promise<{
  itemIds: string[]
  error: Error | null
}> {
  const { favorites, error } = await getFavorites('style')
  return {
    itemIds: favorites.map((f) => f.item_id),
    error,
  }
}

/**
 * Get all favorited palettes for the authenticated user
 */
export async function getFavoritePalettes(): Promise<{
  itemIds: string[]
  error: Error | null
}> {
  const { favorites, error } = await getFavorites('palette')
  return {
    itemIds: favorites.map((f) => f.item_id),
    error,
  }
}

/**
 * Get all favorited thumbnails for the authenticated user
 */
export async function getFavoriteThumbnails(): Promise<{
  itemIds: string[]
  error: Error | null
}> {
  const { favorites, error } = await getFavorites('thumbnail')
  return {
    itemIds: favorites.map((f) => f.item_id),
    error,
  }
}
