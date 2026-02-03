/**
 * Sync Analytics API Route
 * 
 * Manually triggers analytics sync for videos with active experiments.
 * Fetches daily metrics from YouTube Analytics API and upserts into analytics_snapshots.
 */

import { createClient } from '@/lib/supabase/server'
import {
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import { ensureValidToken, isYouTubeConnected } from '@/lib/services/youtube'
import { createServiceClient } from '@/lib/supabase/service'

const YOUTUBE_ANALYTICS_API_BASE = 'https://youtubeanalytics.googleapis.com/v2'

export interface SyncAnalyticsRequest {
  video_ids?: string[]
  user_id?: string
}

/**
 * POST /api/experiments/sync-analytics
 * Sync analytics for videos with active experiments
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const supabaseService = createServiceClient()
    
    // Parse request body
    const body: SyncAnalyticsRequest = await request.json()
    
    // Get user ID from auth or request body
    let userId: string | null = null
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch {
      // If not authenticated, check if user_id is provided in body (for service calls)
      userId = body.user_id || null
    }

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }

    // Check if user has YouTube connected
    const connected = await isYouTubeConnected(userId)
    if (!connected) {
      return NextResponse.json(
        {
          success: false,
          error: 'YouTube not connected',
          code: 'NOT_CONNECTED',
        },
        { status: 404 }
      )
    }

    // Get valid access token
    const accessToken = await ensureValidToken(userId)
    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to get valid access token',
          code: 'TOKEN_ERROR',
        },
        { status: 401 }
      )
    }

    // Get video IDs to sync
    let videoIds: string[] = []

    if (body.video_ids && body.video_ids.length > 0) {
      videoIds = body.video_ids
    } else {
      // Fetch all videos with active experiments (running or completed)
      const { data: experiments, error: expError } = await supabaseService
        .from('experiments')
        .select('video_id')
        .eq('user_id', userId)
        .in('status', ['running', 'completed'])

      if (expError) {
        logError(expError, {
          route: 'POST /api/experiments/sync-analytics',
          userId,
          operation: 'fetch-experiments',
        })
        return databaseErrorResponse('Failed to fetch experiments')
      }

      videoIds = [...new Set((experiments || []).map((e) => e.video_id))]
    }

    if (videoIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No videos to sync',
        synced: 0,
      })
    }

    // Calculate date range: last 60 days (to cover before/during/after windows)
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - 2) // Data lag: 2 days
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 60)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Sync analytics for each video
    const syncResults = await Promise.allSettled(
      videoIds.map(async (videoId) => {
        try {
          // Fetch analytics from YouTube Analytics API
          const url = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`)
          url.searchParams.set('ids', `channel==MINE`)
          url.searchParams.set('dimensions', 'day')
          url.searchParams.set('filters', `video==${videoId}`)
          url.searchParams.set('metrics', 'views,estimatedMinutesWatched,averageViewDuration,likes,subscribersGained')
          url.searchParams.set('startDate', startDateStr)
          url.searchParams.set('endDate', endDateStr)

          const response = await fetch(url.toString(), {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            // Some videos may not have analytics data yet
            if (response.status === 400 || response.status === 403) {
              logInfo('Video analytics not available', {
                route: 'POST /api/experiments/sync-analytics',
                userId,
                videoId,
                status: response.status,
              })
              return { videoId, synced: false, reason: 'not_available' }
            }
            throw new Error(errorData.error?.message || `HTTP ${response.status}`)
          }

          const data = await response.json()

          // Parse response and upsert snapshots
          const rows = data.rows || []
          const headers = data.columnHeaders?.map((h: { name: string }) => h.name) || []

          const viewsIndex = headers.indexOf('views')
          const minutesIndex = headers.indexOf('estimatedMinutesWatched')
          const durationIndex = headers.indexOf('averageViewDuration')
          const likesIndex = headers.indexOf('likes')
          const subscribersIndex = headers.indexOf('subscribersGained')

          const snapshots = rows.map((row: unknown[]) => {
            const day = row[0] as string // First column is always the dimension (day)
            return {
              video_id: videoId,
              day,
              metrics: {
                views: viewsIndex >= 0 ? (row[viewsIndex] as number) || 0 : 0,
                estimatedMinutesWatched: minutesIndex >= 0 ? (row[minutesIndex] as number) || 0 : 0,
                averageViewDuration: durationIndex >= 0 ? (row[durationIndex] as number) || 0 : 0,
                likes: likesIndex >= 0 ? (row[likesIndex] as number) || 0 : 0,
                subscribersGained: subscribersIndex >= 0 ? (row[subscribersIndex] as number) || 0 : 0,
              },
            }
          })

          // Upsert snapshots (service role bypasses RLS)
          if (snapshots.length > 0) {
            const { error: upsertError } = await supabaseService
              .from('analytics_snapshots')
              .upsert(snapshots, {
                onConflict: 'video_id,day',
              })

            if (upsertError) {
              throw upsertError
            }
          }

          logInfo('Analytics synced for video', {
            route: 'POST /api/experiments/sync-analytics',
            userId,
            videoId,
            snapshotsCount: snapshots.length,
          })

          return { videoId, synced: true, snapshotsCount: snapshots.length }
        } catch (error) {
          logError(error, {
            route: 'POST /api/experiments/sync-analytics',
            userId,
            videoId,
            operation: 'sync-video-analytics',
          })
          return { videoId, synced: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })
    )

    const results = syncResults.map((result) =>
      result.status === 'fulfilled' ? result.value : { synced: false, error: 'Promise rejected' }
    )

    const syncedCount = results.filter((r) => r.synced).length

    return NextResponse.json({
      success: true,
      message: `Synced analytics for ${syncedCount} of ${videoIds.length} videos`,
      results,
      synced: syncedCount,
      total: videoIds.length,
    })
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'sync-analytics', undefined, 'Failed to sync analytics')
  }
}
