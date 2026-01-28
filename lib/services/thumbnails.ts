/**
 * Thumbnails Service
 * 
 * Handles all thumbnail CRUD operations via secure API routes.
 * All database operations are server-side only.
 */

import type { 
  DbThumbnail, 
  ThumbnailInsert, 
  ThumbnailUpdate
} from '@/lib/types/database'

export interface ThumbnailsQueryOptions {
  limit?: number
  offset?: number // Deprecated - use cursor instead
  cursor?: string | null // Cursor for pagination
  orderBy?: 'created_at' | 'title'
  orderDirection?: 'asc' | 'desc'
  favoritesOnly?: boolean
}

export interface ThumbnailsQueryResponse {
  thumbnails: DbThumbnail[]
  count: number
  nextCursor: string | null
  hasNextPage: boolean
}

/**
 * Get thumbnails for a user with pagination
 */
export async function getThumbnails(
  userId: string,
  options: ThumbnailsQueryOptions = {}
): Promise<{
  thumbnails: DbThumbnail[]
  count: number
  nextCursor: string | null
  hasNextPage: boolean
  error: Error | null
}> {
  const {
    limit = 24,
    cursor = null,
    orderBy = 'created_at',
    orderDirection = 'desc',
    favoritesOnly = false,
  } = options

  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      orderBy,
      orderDirection,
      ...(favoritesOnly && { favoritesOnly: 'true' }),
      ...(cursor && { cursor }),
    })
    const url = `/api/thumbnails?${params.toString()}`;
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        thumbnails: [],
        count: 0,
        nextCursor: null,
        hasNextPage: false,
        error: new Error(errorData.error || 'Failed to fetch thumbnails'),
      }
    }

    const data = await response.json()
    return {
      thumbnails: data.thumbnails || [],
      count: data.count || 0,
      nextCursor: data.nextCursor || null,
      hasNextPage: data.hasNextPage || false,
      error: null,
    }
  } catch (error) {
    return {
      thumbnails: [],
      count: 0,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get a single thumbnail by ID
 */
export async function getThumbnail(id: string): Promise<{
  thumbnail: DbThumbnail | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/thumbnails/${id}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        thumbnail: null,
        error: new Error(errorData.error || 'Failed to fetch thumbnail'),
      }
    }

    const data = await response.json()
    return {
      thumbnail: data,
      error: null,
    }
  } catch (error) {
    return {
      thumbnail: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Create a new thumbnail record
 * Note: This is rarely used directly - thumbnails are usually created via /api/generate
 */
export async function createThumbnail(
  data: ThumbnailInsert
): Promise<{
  thumbnail: DbThumbnail | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/thumbnails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        thumbnail: null,
        error: new Error(errorData.error || 'Failed to create thumbnail'),
      }
    }

    const result = await response.json()
    return {
      thumbnail: result.thumbnail,
      error: null,
    }
  } catch (error) {
    return {
      thumbnail: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Update a thumbnail
 */
export async function updateThumbnail(
  id: string,
  updates: ThumbnailUpdate
): Promise<{
  thumbnail: DbThumbnail | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/thumbnails/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        thumbnail: null,
        error: new Error(errorData.error || 'Failed to update thumbnail'),
      }
    }

    const result = await response.json()
    return {
      thumbnail: result.thumbnail,
      error: null,
    }
  } catch (error) {
    return {
      thumbnail: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Delete a thumbnail (record + storage file)
 */
export async function deleteThumbnail(
  id: string
): Promise<{
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/thumbnails/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        error: new Error(errorData.error || 'Failed to delete thumbnail'),
      }
    }

    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Toggle favorite status for a thumbnail
 */
export async function toggleThumbnailFavorite(id: string): Promise<{
  liked: boolean
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/thumbnails/${id}/favorite`, {
      method: 'POST',
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        liked: false,
        error: new Error(errorData.error || 'Failed to toggle favorite'),
      }
    }

    const data = await response.json()
    return {
      liked: data.liked,
      error: null,
    }
  } catch (error) {
    return {
      liked: false,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Toggle public status for a thumbnail
 */
export async function toggleThumbnailPublic(id: string): Promise<{
  isPublic: boolean
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/thumbnails/${id}/public`, {
      method: 'POST',
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        isPublic: false,
        error: new Error(errorData.error || 'Failed to toggle public status'),
      }
    }

    const data = await response.json()
    return {
      isPublic: data.isPublic,
      error: null,
    }
  } catch (error) {
    return {
      isPublic: false,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}


/**
 * Get public thumbnails with pagination (no authentication required)
 */
export async function getPublicThumbnails(
  options: { limit?: number; offset?: number } = {}
): Promise<{
  thumbnails: DbThumbnail[]
  count: number
  error: Error | null
}> {
  const {
    limit = 20,
    offset = 0,
  } = options

  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    const response = await fetch(`/api/thumbnails/public?${params.toString()}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        thumbnails: [],
        count: 0,
        error: new Error(errorData.error || 'Failed to fetch public thumbnails'),
      }
    }

    const data = await response.json()
    return {
      thumbnails: data.thumbnails || [],
      count: data.count || 0,
      error: null,
    }
  } catch (error) {
    return {
      thumbnails: [],
      count: 0,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Search thumbnails by title (server-side)
 */
export async function searchThumbnails(
  userId: string,
  query: string,
  limit: number = 20
): Promise<{
  thumbnails: DbThumbnail[]
  error: Error | null
}> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      offset: '0',
    })

    const response = await fetch(`/api/thumbnails/search?${params.toString()}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        thumbnails: [],
        error: new Error(errorData.error || 'Failed to search thumbnails'),
      }
    }

    const data = await response.json()
    return {
      thumbnails: data.thumbnails || [],
      error: null,
    }
  } catch (error) {
    return {
      thumbnails: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Generate a new thumbnail using AI
 */
export interface GenerateThumbnailOptions {
  title: string
  emotion?: string
  pose?: string
  style?: string
  palette?: string
  resolution?: '1K' | '2K' | '4K'
  aspectRatio?: string
  referenceImages?: string[]
  faceImages?: string[] // DEPRECATED - keep for backward compatibility
  faceCharacters?: Array<{ images: string[] }> // NEW - grouped by character
  customStyle?: string
  thumbnailText?: string
  variations?: number // Number of variations to generate (1-4, default: 1)
}

export interface GenerateThumbnailResult {
  // Single result (backward compatible)
  imageUrl?: string
  thumbnailId?: string
  creditsUsed?: number
  creditsRemaining?: number
  // Batch results
  results?: Array<{
    success: boolean
    thumbnailId?: string
    imageUrl?: string
    error?: string
  }>
  totalRequested?: number
  totalSucceeded?: number
  totalFailed?: number
  // Refund failure warning (when refund fails after generation failure)
  refundFailureWarning?: {
    amount: number
    reason: string
    requestId: string
  }
}

export async function generateThumbnail(
  options: GenerateThumbnailOptions
): Promise<{
  result: GenerateThumbnailResult | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    if (!response.ok) {
      const errorData = await response.json()
      const error = new Error(errorData.error || 'Failed to generate thumbnail')
      
      // Include refund failure warning in error if present
      if (errorData.refundFailureWarning) {
        (error as any).refundFailureWarning = errorData.refundFailureWarning
      }
      
      return {
        result: null,
        error,
      }
    }

    const data = await response.json()
    return {
      result: data,
      error: null,
    }
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Edit an existing thumbnail using AI
 */
export async function editThumbnail(
  thumbnailId: string,
  editPrompt: string,
  referenceImages?: string[]
): Promise<{
  result: GenerateThumbnailResult | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        thumbnailId,
        editPrompt,
        referenceImages: referenceImages && referenceImages.length > 0 ? referenceImages : undefined,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      const error = new Error(errorData.error || 'Failed to edit thumbnail')
      
      // Include refund failure warning in error if present
      if (errorData.refundFailureWarning) {
        (error as any).refundFailureWarning = errorData.refundFailureWarning
      }
      
      return {
        result: null,
        error,
      }
    }

    const data = await response.json()
    return {
      result: data,
      error: null,
    }
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Enhance a video title with AI suggestions
 */
export interface EnhanceTitleOptions {
  title: string
  style?: string
  emotion?: string
}

export async function enhanceTitle(
  options: EnhanceTitleOptions
): Promise<{
  suggestions: string[]
  error: Error | null
}> {
  try {
    const response = await fetch('/api/enhance-title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        suggestions: [],
        error: new Error(errorData.error || 'Failed to enhance title'),
      }
    }

    const data = await response.json()
    return {
      suggestions: data.suggestions || [],
      error: null,
    }
  } catch (error) {
    return {
      suggestions: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}
