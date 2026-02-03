/**
 * YouTube Videos API Route
 * 
 * Fetches the latest 10 videos from the authenticated user's YouTube channel.
 * Does NOT persist video data - returns fresh data from YouTube API.
 * Implements server-side caching (10 minutes per user) to avoid API spam.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import {
  ensureValidToken,
  isYouTubeConnected,
} from '@/lib/services/youtube'
import { youtubePlaylistCache, getCached } from '@/lib/server/utils/lru-cache'
import { LRUCache } from 'lru-cache'

// ============================================================================
// In-Memory Cache (10 minutes per user)
// ============================================================================

interface CachedVideos {
  videos: YouTubeVideo[]
  nextPageToken: string | null
  hasMore: boolean
}

// Use LRU cache for videos (replaces Map with TTL management)
const videoCache = new LRUCache<string, CachedVideos>({
  max: 500,
  ttl: 10 * 60 * 1000, // 10 minutes
})

function getCachedVideos(userId: string): YouTubeVideosResponse | null {
  const cached = videoCache.get(userId)
  if (!cached) return null
  
  return {
    videos: cached.videos,
    nextPageToken: cached.nextPageToken,
    hasMore: cached.hasMore,
  }
}

function clearCacheForUser(userId: string): void {
  videoCache.delete(userId)
}

function setCachedVideos(userId: string, response: YouTubeVideosResponse): void {
  videoCache.set(userId, {
    videos: response.videos,
    nextPageToken: response.nextPageToken,
    hasMore: response.hasMore,
  })
}

// ============================================================================
// Types
// ============================================================================

export interface YouTubeVideo {
  videoId: string
  title: string
  publishedAt: string
  thumbnailUrl: string
  viewCount?: number
  likeCount?: number
  /** Duration in seconds (from contentDetails.duration). Used to classify Shorts (< 60s). */
  durationSeconds?: number
}

export interface YouTubeVideosResponse {
  videos: YouTubeVideo[]
  nextPageToken: string | null
  hasMore: boolean
}

// ============================================================================
// YouTube API Constants
// ============================================================================

const YOUTUBE_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3'

// ============================================================================
// YouTube API Functions
// ============================================================================

/**
 * Get the uploads playlist ID for the authenticated user's channel
 */
async function getUploadsPlaylistId(accessToken: string): Promise<string | null> {
  try {
    const url = new URL(`${YOUTUBE_DATA_API_BASE}/channels`)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('mine', 'true')
    
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      logError(new Error('YouTube API error'), {
        service: 'youtube',
        operation: 'getUploadsPlaylistId',
        status: response.status,
        error: errorData.error?.message,
      })
      return null
    }
    
    const data = await response.json()
    
    if (!data.items || data.items.length === 0) {
      return null
    }
    
    const uploadsPlaylistId = data.items[0]?.contentDetails?.relatedPlaylists?.uploads
    return uploadsPlaylistId || null
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'getUploadsPlaylistId',
    })
    return null
  }
}

/**
 * Get videos from a playlist with pagination support
 */
async function getPlaylistVideos(
  accessToken: string,
  playlistId: string,
  maxResults: number = 10,
  pageToken?: string
): Promise<YouTubeVideosResponse> {
  try {
    const url = new URL(`${YOUTUBE_DATA_API_BASE}/playlistItems`)
    url.searchParams.set('part', 'snippet,contentDetails')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('maxResults', maxResults.toString())
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      logError(new Error('YouTube API error'), {
        service: 'youtube',
        operation: 'getPlaylistVideos',
        status: response.status,
        error: errorData.error?.message,
      })
      return { videos: [], nextPageToken: null, hasMore: false }
    }
    
    const data = await response.json()
    
    if (!data.items || data.items.length === 0) {
      return { videos: [], nextPageToken: null, hasMore: false }
    }
    
    // Extract video data with best available thumbnail; dedupe by videoId (keep first)
    const seenIds = new Set<string>()
    const videos: YouTubeVideo[] = []
    for (const item of data.items) {
      const videoId = item.contentDetails?.videoId || ''
      if (!videoId || seenIds.has(videoId)) continue
      seenIds.add(videoId)
      const snippet = item.snippet || {}
      const thumbnails = snippet.thumbnails || {}
      const thumbnailUrl = thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || null
      videos.push({
        videoId,
        title: snippet.title || 'Untitled',
        publishedAt: snippet.publishedAt || '',
        thumbnailUrl: thumbnailUrl || '',
      })
    }

    const nextPageToken = data.nextPageToken || null
    const hasMore = !!nextPageToken

    return { videos, nextPageToken, hasMore }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'getPlaylistVideos',
    })
    return { videos: [], nextPageToken: null, hasMore: false }
  }
}

/**
 * Parse ISO 8601 duration (e.g. PT1H2M10S) to seconds
 */
function parseDurationToSeconds(isoDuration: string | null | undefined): number | undefined {
  if (!isoDuration || typeof isoDuration !== 'string') return undefined
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i)
  if (!match) return undefined
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Attach viewCount, likeCount, and durationSeconds to videos via videos.list (batch)
 */
async function attachVideoStatisticsAndDuration(
  accessToken: string,
  videos: YouTubeVideo[]
): Promise<YouTubeVideo[]> {
  if (videos.length === 0) return videos

  const ids = videos.map((v) => v.videoId)
  const batchSize = 50
  const enriched: YouTubeVideo[] = []

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const url = new URL(`${YOUTUBE_DATA_API_BASE}/videos`)
    url.searchParams.set('part', 'statistics,contentDetails')
    url.searchParams.set('id', batch.join(','))

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      logError(new Error('YouTube videos list API error'), {
        service: 'youtube',
        operation: 'attachVideoStatisticsAndDuration',
        status: response.status,
      })
      return videos
    }

    const data = await response.json()
    const itemsById = new Map<string | undefined, { statistics?: { viewCount?: string; likeCount?: string }; contentDetails?: { duration?: string } }>()
    for (const item of data.items || []) {
      itemsById.set(item.id, {
        statistics: item.statistics,
        contentDetails: item.contentDetails,
      })
    }

    for (const v of videos.slice(i, i + batchSize)) {
      const item = itemsById.get(v.videoId)
      const stats = item?.statistics
      const details = item?.contentDetails
      enriched.push({
        ...v,
        viewCount: stats?.viewCount != null ? parseInt(stats.viewCount, 10) : undefined,
        likeCount: stats?.likeCount != null ? parseInt(stats.likeCount, 10) : undefined,
        durationSeconds: parseDurationToSeconds(details?.duration),
      })
    }
  }

  return enriched
}

/**
 * Fetch videos from YouTube with optional pagination
 */
async function fetchVideos(
  userId: string,
  pageToken?: string
): Promise<YouTubeVideosResponse> {
  // Only check cache for first page (no pageToken)
  if (!pageToken) {
    const cached = getCachedVideos(userId)
    if (cached) {
      logInfo('Returning cached videos', {
        route: 'GET /api/youtube/videos',
        userId,
        count: cached.videos.length,
      })
      return cached
    }
  }
  
  // Ensure we have a valid access token
  const accessToken = await ensureValidToken(userId)
  if (!accessToken) {
    throw new Error('Unable to get valid access token')
  }
  
  // Step 1: Get the uploads playlist ID (cached per user)
  const uploadsPlaylistId = await getCached(
    youtubePlaylistCache,
    userId,
    async () => {
      const playlistId = await getUploadsPlaylistId(accessToken)
      if (!playlistId) {
        throw new Error('Unable to get uploads playlist ID')
      }
      return playlistId
    }
  )
  
  // Step 2: Get videos from the uploads playlist
  let result = await getPlaylistVideos(accessToken, uploadsPlaylistId, 10, pageToken)
  result = {
    ...result,
    videos: await attachVideoStatisticsAndDuration(accessToken, result.videos),
  }

  // Cache the results only for first page
  if (!pageToken && result.videos.length > 0) {
    setCachedVideos(userId, result)
  }

  logInfo('Fetched videos from YouTube', {
    route: 'GET /api/youtube/videos',
    userId,
    count: result.videos.length,
    hasMore: result.hasMore,
    isFirstPage: !pageToken,
  })
  
  return result
}

// ============================================================================
// API Route Handlers
// ============================================================================

/**
 * GET /api/youtube/videos
 * Returns videos from the authenticated user's YouTube channel
 * Query params: ?pageToken=<token> for pagination
 * Uses server-side caching (10 minutes per user) for first page only
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    
    // Check if user has YouTube connected
    const connected = await isYouTubeConnected(user.id)
    if (!connected) {
      return NextResponse.json({
        success: false,
        error: 'YouTube not connected',
        code: 'NOT_CONNECTED',
      }, { status: 404 })
    }
    
    // Get pageToken from query params if provided
    const url = new URL(request.url)
    const pageToken = url.searchParams.get('pageToken') || undefined
    
    // Fetch videos (uses cache internally for first page)
    const result = await fetchVideos(user.id, pageToken)
    
    return NextResponse.json({
      success: true,
      videos: result.videos,
      nextPageToken: result.nextPageToken,
      hasMore: result.hasMore,
      count: result.videos.length,
    })
    
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }

    // Token refresh failed (invalid_grant, unauthorized_client, etc.) — ask client to reconnect
    const message = error instanceof Error ? error.message : ''
    if (message === 'Unable to get valid access token') {
      return NextResponse.json(
        {
          success: false,
          error: 'YouTube token expired or revoked. Please reconnect your account.',
          code: 'REAUTH_REQUIRED',
        },
        { status: 401 }
      )
    }

    logError(error, {
      route: 'GET /api/youtube/videos',
      operation: 'fetch-videos',
    })

    return serverErrorResponse(error, 'Failed to fetch videos')
  }
}
