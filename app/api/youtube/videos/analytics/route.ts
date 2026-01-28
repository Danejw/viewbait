/**
 * YouTube Videos Analytics API Route
 * 
 * Fetches the latest 10 videos with detailed analytics from the authenticated user's YouTube channel.
 * Includes per-video analytics: watch time, time series, traffic sources, and impressions.
 * Does NOT persist video data - returns fresh data from YouTube API.
 * Implements server-side caching (10 minutes per user) to avoid API spam.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import {
  ensureValidToken,
  isYouTubeConnected,
  fetchVideoDetailsFromDataAPI,
  fetchPerVideoAnalytics,
  fetchVideoAnalyticsTimeSeries,
  fetchVideoTrafficSources,
  fetchVideoImpressions,
  getDateRangeForLastNDays,
} from '@/lib/services/youtube'

// ============================================================================
// In-Memory Cache (10 minutes per user)
// ============================================================================

interface CachedVideosWithAnalytics {
  videos: VideoWithAnalytics[]
  cachedAt: number
}

const analyticsCache = new Map<string, CachedVideosWithAnalytics>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function getCachedVideosWithAnalytics(userId: string): VideoWithAnalytics[] | null {
  const cached = analyticsCache.get(userId)
  if (!cached) return null
  
  const age = Date.now() - cached.cachedAt
  if (age > CACHE_TTL_MS) {
    analyticsCache.delete(userId)
    return null
  }
  
  return cached.videos
}

function setCachedVideosWithAnalytics(userId: string, videos: VideoWithAnalytics[]): void {
  analyticsCache.set(userId, {
    videos,
    cachedAt: Date.now(),
  })
}

// ============================================================================
// Types
// ============================================================================

export interface VideoAnalyticsTimeSeries {
  date: string // YYYY-MM-DD
  views: number
}

export interface VideoTrafficSource {
  sourceType: string // e.g., "YT_SEARCH", "RELATED_VIDEO", etc.
  views: number
}

export interface VideoImpressions {
  impressions: number | null
  impressionsClickThroughRate: number | null // percentage (0-100)
}

export interface VideoWithAnalytics {
  videoId: string
  title: string
  description: string
  thumbnailUrl: string
  publishedAt: string
  // Public counts
  viewCount: number
  likeCount: number
  commentCount: number
  // Analytics (last 28 days)
  watchTimeMinutes: number
  averageViewDurationSeconds: number
  // Time series (daily views for last 28 days)
  timeSeries: VideoAnalyticsTimeSeries[]
  // Traffic sources
  trafficSources: VideoTrafficSource[]
  // Impressions (may be null)
  impressions: VideoImpressions
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the uploads playlist ID and fetch latest 10 video IDs
 */
async function getLatestVideoIds(accessToken: string): Promise<string[]> {
  try {
    // Get uploads playlist ID
    const channelsUrl = new URL('https://www.googleapis.com/youtube/v3/channels')
    channelsUrl.searchParams.set('part', 'contentDetails')
    channelsUrl.searchParams.set('mine', 'true')
    
    const channelsResponse = await fetch(channelsUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!channelsResponse.ok) {
      const errorData = await channelsResponse.json()
      logError(new Error('YouTube API error'), {
        service: 'youtube',
        operation: 'getLatestVideoIds',
        status: channelsResponse.status,
        error: errorData.error?.message,
      })
      return []
    }
    
    const channelsData = await channelsResponse.json()
    const uploadsPlaylistId = channelsData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    
    if (!uploadsPlaylistId) {
      return []
    }
    
    // Get latest 10 videos from uploads playlist
    const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
    playlistUrl.searchParams.set('part', 'contentDetails')
    playlistUrl.searchParams.set('playlistId', uploadsPlaylistId)
    playlistUrl.searchParams.set('maxResults', '10')
    
    const playlistResponse = await fetch(playlistUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!playlistResponse.ok) {
      const errorData = await playlistResponse.json()
      logError(new Error('YouTube API error'), {
        service: 'youtube',
        operation: 'getLatestVideoIds',
        status: playlistResponse.status,
        error: errorData.error?.message,
      })
      return []
    }
    
    const playlistData = await playlistResponse.json()
    const videoIds = (playlistData.items || [])
      .map((item: any) => item.contentDetails?.videoId)
      .filter((id: string | undefined) => id)
    
    return videoIds
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'getLatestVideoIds',
    })
    return []
  }
}

/**
 * Fetch analytics for a single video
 */
async function fetchVideoAnalyticsData(
  videoId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<Partial<VideoWithAnalytics> | null> {
  try {
    // Fetch video details (title, description, thumbnail, public counts)
    const videoDetails = await fetchVideoDetailsFromDataAPI(videoId, accessToken)
    if (!videoDetails) {
      return null
    }
    
    // Fetch aggregate analytics
    const analytics = await fetchPerVideoAnalytics(videoId, accessToken, startDate, endDate)
    
    // Fetch time series
    const timeSeries = await fetchVideoAnalyticsTimeSeries(videoId, accessToken, startDate, endDate)
    
    // Fetch traffic sources
    const trafficSources = await fetchVideoTrafficSources(videoId, accessToken, startDate, endDate)
    
    // Fetch impressions (may return null if not available)
    const impressions = await fetchVideoImpressions(videoId, accessToken, startDate, endDate)
    
    return {
      videoId,
      title: videoDetails.title,
      description: videoDetails.description,
      thumbnailUrl: videoDetails.thumbnailUrl,
      publishedAt: videoDetails.publishedAt,
      viewCount: videoDetails.viewCount,
      likeCount: videoDetails.likeCount,
      commentCount: videoDetails.commentCount,
      watchTimeMinutes: analytics?.watchTimeMinutes || 0,
      averageViewDurationSeconds: analytics?.averageViewDurationSeconds || 0,
      timeSeries: timeSeries || [],
      trafficSources: trafficSources || [],
      impressions: impressions || { impressions: null, impressionsClickThroughRate: null },
    }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchVideoAnalyticsData',
      videoId,
    })
    return null
  }
}

/**
 * Fetch videos with analytics for all latest videos
 */
async function fetchVideosWithAnalytics(
  userId: string
): Promise<VideoWithAnalytics[]> {
  // Check cache first
  const cached = getCachedVideosWithAnalytics(userId)
  if (cached) {
    logInfo('Returning cached videos with analytics', {
      route: 'GET /api/youtube/videos/analytics',
      userId,
      count: cached.length,
    })
    return cached
  }
  
  // Ensure we have a valid access token
  const accessToken = await ensureValidToken(userId)
  if (!accessToken) {
    throw new Error('Unable to get valid access token')
  }
  
  // Get latest 10 video IDs
  const videoIds = await getLatestVideoIds(accessToken)
  if (videoIds.length === 0) {
    return []
  }
  
  // Get date range for last 28 days
  const { startDate, endDate } = getDateRangeForLastNDays(28)
  
  // Fetch analytics for each video (in parallel, but with error handling)
  const videoPromises = videoIds.map(videoId =>
    fetchVideoAnalyticsData(videoId, accessToken, startDate, endDate)
  )
  
  const results = await Promise.allSettled(videoPromises)
  
  // Filter out failed requests and null results
  const videos: VideoWithAnalytics[] = results
    .map((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        return result.value as VideoWithAnalytics
      }
      // Log error but don't fail entire request
      if (result.status === 'rejected') {
        logError(result.reason, {
          service: 'youtube',
          operation: 'fetchVideosWithAnalytics',
          videoId: videoIds[index],
        })
      }
      return null
    })
    .filter((video): video is VideoWithAnalytics => video !== null)
  
  // Cache the results
  if (videos.length > 0) {
    setCachedVideosWithAnalytics(userId, videos)
  }
  
  logInfo('Fetched videos with analytics from YouTube', {
    route: 'GET /api/youtube/videos/analytics',
    userId,
    count: videos.length,
    requested: videoIds.length,
  })
  
  return videos
}

// ============================================================================
// API Route Handlers
// ============================================================================

/**
 * GET /api/youtube/videos/analytics
 * Returns videos with detailed analytics from the authenticated user's YouTube channel
 * Uses server-side caching (10 minutes per user)
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
    
    // Fetch videos with analytics (uses cache internally)
    const videos = await fetchVideosWithAnalytics(user.id)
    
    return NextResponse.json({
      success: true,
      videos,
      count: videos.length,
    })
    
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    
    logError(error, {
      route: 'GET /api/youtube/videos/analytics',
      operation: 'fetch-videos-with-analytics',
    })
    
    return serverErrorResponse(error, 'Failed to fetch videos with analytics')
  }
}
