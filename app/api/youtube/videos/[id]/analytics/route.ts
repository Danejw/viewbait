/**
 * Single-video YouTube Analytics API Route
 *
 * GET /api/youtube/videos/[id]/analytics
 * Fetches detailed analytics for one video: details, watch time, time series,
 * traffic sources, impressions. Uses same helpers as the bulk videos/analytics route.
 * Optional server-side cache (10 min per user+video) to avoid repeated calls.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { handleApiError } from '@/lib/server/utils/api-helpers'
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
import type {
  VideoAnalyticsTimeSeries,
  VideoTrafficSource,
  VideoImpressions,
  VideoWithAnalytics,
} from '@/app/api/youtube/videos/analytics/route'

// ============================================================================
// In-Memory Cache (10 minutes per user+video)
// ============================================================================

const singleVideoCache = new Map<string, { data: VideoWithAnalytics; cachedAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function getCacheKey(userId: string, videoId: string): string {
  return `${userId}:${videoId}`
}

function getCachedVideoAnalytics(userId: string, videoId: string): VideoWithAnalytics | null {
  const key = getCacheKey(userId, videoId)
  const entry = singleVideoCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    singleVideoCache.delete(key)
    return null
  }
  return entry.data
}

function setCachedVideoAnalytics(userId: string, videoId: string, data: VideoWithAnalytics): void {
  singleVideoCache.set(getCacheKey(userId, videoId), { data, cachedAt: Date.now() })
}

// ============================================================================
// Helper
// ============================================================================

async function fetchVideoAnalyticsData(
  videoId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<VideoWithAnalytics | null> {
  const videoDetails = await fetchVideoDetailsFromDataAPI(videoId, accessToken)
  if (!videoDetails) {
    return null
  }

  const analytics = await fetchPerVideoAnalytics(videoId, accessToken, startDate, endDate)
  const timeSeries = await fetchVideoAnalyticsTimeSeries(videoId, accessToken, startDate, endDate)
  const trafficSources = await fetchVideoTrafficSources(videoId, accessToken, startDate, endDate)
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
    watchTimeMinutes: analytics?.watchTimeMinutes ?? 0,
    averageViewDurationSeconds: analytics?.averageViewDurationSeconds ?? 0,
    timeSeries: (timeSeries as VideoAnalyticsTimeSeries[]) ?? [],
    trafficSources: (trafficSources as VideoTrafficSource[]) ?? [],
    impressions: impressions ?? { impressions: null, impressionsClickThroughRate: null },
  }
}

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/youtube/videos/[id]/analytics
 * Returns analytics for a single video. Requires auth and YouTube connection.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params
    if (!videoId?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Video ID required', code: 'MISSING_VIDEO_ID' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const connected = await isYouTubeConnected(user.id)
    if (!connected) {
      return NextResponse.json(
        { success: false, error: 'YouTube not connected', code: 'NOT_CONNECTED' },
        { status: 404 }
      )
    }

    const cached = getCachedVideoAnalytics(user.id, videoId)
    if (cached) {
      logInfo('Returning cached single-video analytics', {
        route: 'GET /api/youtube/videos/[id]/analytics',
        userId: user.id,
        videoId,
      })
      return NextResponse.json({ success: true, video: cached })
    }

    const accessToken = await ensureValidToken(user.id)
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Unable to get valid access token', code: 'TOKEN_ERROR' },
        { status: 401 }
      )
    }

    const { startDate, endDate } = getDateRangeForLastNDays(28)
    const video = await fetchVideoAnalyticsData(videoId, accessToken, startDate, endDate)

    if (!video) {
      return NextResponse.json(
        { success: false, error: 'Video not found or analytics unavailable', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    setCachedVideoAnalytics(user.id, videoId, video)
    logInfo('Fetched single-video analytics', {
      route: 'GET /api/youtube/videos/[id]/analytics',
      userId: user.id,
      videoId,
    })

    return NextResponse.json({ success: true, video })
  } catch (error) {
    return handleApiError(
      error,
      'GET /api/youtube/videos/[id]/analytics',
      'fetch-single-video-analytics',
      undefined,
      'Failed to fetch video analytics'
    )
  }
}
