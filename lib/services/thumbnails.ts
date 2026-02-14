/**
 * Thumbnails Service
 * 
 * Handles all thumbnail CRUD operations via secure API routes.
 * All database operations are server-side only.
 */

import { fetchWithTimeout, DEFAULT_LIST_DETAIL_TIMEOUT_MS } from '@/lib/utils/fetch-with-timeout'
import type {
  DbThumbnail,
  ThumbnailComment,
  ThumbnailInsert,
  ThumbnailUpdate,
  ThumbnailLivePeriod,
} from '@/lib/types/database'

export interface ThumbnailsQueryOptions {
  limit?: number
  offset?: number // Deprecated - use cursor instead
  cursor?: string | null // Cursor for pagination
  orderBy?: 'created_at' | 'title'
  orderDirection?: 'asc' | 'desc'
  favoritesOnly?: boolean
  /** When set, filter thumbnails by this project. Omit or null = All thumbnails */
  projectId?: string | null
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
    projectId,
  } = options

  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      orderBy,
      orderDirection,
      ...(favoritesOnly && { favoritesOnly: 'true' }),
      ...(cursor && { cursor }),
      ...(projectId && { projectId }),
    })
    const url = `/api/thumbnails?${params.toString()}`;
    const response = await fetchWithTimeout(url, {
      credentials: 'include',
      timeoutMs: DEFAULT_LIST_DETAIL_TIMEOUT_MS,
    })
    
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
      nextCursor: null,
      hasNextPage: false,
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
 * Get live periods for a thumbnail (when it was promoted to YouTube videos).
 * User must own the thumbnail.
 */
export async function getThumbnailLivePeriods(thumbnailId: string): Promise<{
  periods: ThumbnailLivePeriod[]
  error: Error | null
}> {
  try {
    const response = await fetchWithTimeout(
      `/api/thumbnails/${thumbnailId}/live-periods`,
      { credentials: 'include', timeoutMs: DEFAULT_LIST_DETAIL_TIMEOUT_MS }
    )
    if (!response.ok) {
      const errorData = await response.json()
      return {
        periods: [],
        error: new Error(errorData.error || 'Failed to fetch live periods'),
      }
    }
    const data = await response.json()
    return { periods: data.periods ?? [], error: null }
  } catch (error) {
    return {
      periods: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get live periods for multiple thumbnails in one request.
 * Returns a map of thumbnailId -> periods. Only includes thumbnails owned by the user.
 */
export async function getThumbnailLivePeriodsBatch(thumbnailIds: string[]): Promise<{
  periodsByThumbnailId: Record<string, ThumbnailLivePeriod[]>
  error: Error | null
}> {
  if (thumbnailIds.length === 0) {
    return { periodsByThumbnailId: {}, error: null }
  }
  try {
    const ids = thumbnailIds.slice(0, 20).join(',')
    const response = await fetchWithTimeout(
      `/api/thumbnails/live-periods?ids=${encodeURIComponent(ids)}`,
      { credentials: 'include', timeoutMs: DEFAULT_LIST_DETAIL_TIMEOUT_MS }
    )
    if (!response.ok) {
      const errorData = await response.json()
      return {
        periodsByThumbnailId: {},
        error: new Error(errorData.error || 'Failed to fetch live periods'),
      }
    }
    const data = await response.json()
    return { periodsByThumbnailId: data.periodsByThumbnailId ?? {}, error: null }
  } catch (error) {
    return {
      periodsByThumbnailId: {},
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get comments for a thumbnail (auth required).
 * When projectId is provided: user must have project access (owner or editor).
 * When projectId is omitted: only the thumbnail owner can read (owner-only path).
 */
export async function getThumbnailComments(
  thumbnailId: string,
  projectId?: string | null
): Promise<{ comments: ThumbnailComment[]; error: Error | null }> {
  try {
    const url =
      projectId != null && projectId !== ''
        ? `/api/thumbnails/${thumbnailId}/comments?${new URLSearchParams({ projectId }).toString()}`
        : `/api/thumbnails/${thumbnailId}/comments`
    const response = await fetchWithTimeout(url, {
      credentials: 'include',
      timeoutMs: DEFAULT_LIST_DETAIL_TIMEOUT_MS,
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        comments: [],
        error: new Error(errorData.error || 'Failed to fetch comments'),
      }
    }
    const data = await response.json()
    return { comments: data.comments ?? [], error: null }
  } catch (error) {
    return {
      comments: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Post a comment on a thumbnail (auth required; project access + rate limit).
 */
export async function postThumbnailComment(
  thumbnailId: string,
  projectId: string,
  comment: string
): Promise<{ comments: ThumbnailComment[]; error: Error | null }> {
  try {
    const response = await fetchWithTimeout(
      `/api/thumbnails/${thumbnailId}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, comment }),
        credentials: 'include',
        timeoutMs: DEFAULT_LIST_DETAIL_TIMEOUT_MS,
      }
    )
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        comments: [],
        error: new Error(errorData.error || 'Failed to post comment'),
      }
    }
    const data = await response.json()
    return { comments: data.comments ?? [], error: null }
  } catch (error) {
    return {
      comments: [],
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
    const url = typeof window !== 'undefined'
      ? `/api/thumbnails/${id}`
      : `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/thumbnails/${id}`
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
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
 * Update a thumbnail's project (move to project / remove from project).
 * Calls POST /api/thumbnails/[id]/project with { project_id }.
 * Use projectId: null to set the thumbnail to "No project" (DB project_id = NULL).
 */
export async function updateThumbnailProject(
  id: string,
  projectId: string | null
): Promise<{ thumbnail: DbThumbnail | null; error: Error | null }> {
  try {
    const url =
      typeof window !== 'undefined'
        ? `/api/thumbnails/${id}/project`
        : `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/thumbnails/${id}/project`
    // Always send project_id; null explicitly unassigns (sets DB column to NULL)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ project_id: projectId }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        thumbnail: null,
        error: new Error(
          (errorData as { error?: string }).error || 'Failed to update thumbnail project'
        ),
      }
    }

    const result = await response.json()
    return {
      thumbnail: (result as { thumbnail: DbThumbnail }).thumbnail ?? null,
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
  /** Optional project id; thumbnail will be associated with this project if valid */
  project_id?: string | null
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
      let errorMessage: string
      let errorData: { error?: string; refundFailureWarning?: unknown } | null = null
      try {
        errorData = await response.json()
        errorMessage = errorData?.error ?? ''
      } catch {
        errorData = null
        errorMessage = ''
      }
      // Status-based fallback when body is not JSON or error field missing
      if (!errorMessage) {
        if (response.status === 503) {
          errorMessage = 'Service temporarily unavailable. Please try again in a few minutes.'
        } else if (response.status === 500) {
          errorMessage = 'Generation failed. Please try again.'
        } else {
          errorMessage = 'Something went wrong. Please try again.'
        }
      }
      const error = new Error(errorMessage)
      if (errorData?.refundFailureWarning) {
        (error as Error & { refundFailureWarning?: unknown }).refundFailureWarning =
          errorData.refundFailureWarning
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
  referenceImages?: string[],
  title?: string
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
        title: title != null && title.trim() !== '' ? title.trim() : undefined,
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

/**
 * Analyze a thumbnail image and return a short style description (max 500 chars)
 * for appending to custom instructions. Accepts imageUrl (e.g. YouTube or signed URL)
 * and/or thumbnailId (owned thumbnail; server loads from storage to avoid URL expiry).
 */
export async function analyzeThumbnailStyleForInstructions(params: {
  imageUrl?: string
  thumbnailId?: string
}): Promise<{ description: string | null; error: Error | null }> {
  const hasImageUrl = typeof params.imageUrl === 'string' && params.imageUrl.trim().length > 0
  const hasThumbnailId = typeof params.thumbnailId === 'string' && params.thumbnailId.trim().length > 0

  if (!hasImageUrl && !hasThumbnailId) {
    return {
      description: null,
      error: new Error('At least one of imageUrl or thumbnailId is required'),
    }
  }

  try {
    const body: { imageUrl?: string; thumbnailId?: string } = {}
    if (hasImageUrl) body.imageUrl = params.imageUrl
    if (hasThumbnailId) body.thumbnailId = params.thumbnailId

    const response = await fetch('/api/thumbnails/analyze-style-for-instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        description: null,
        error: new Error(
          errorData.error || 'Failed to analyze thumbnail style'
        ),
      }
    }

    const data = await response.json()
    return {
      description: data.description ?? null,
      error: null,
    }
  } catch (error) {
    return {
      description: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}
