/**
 * YouTube Analytics API Route
 * 
 * Handles fetching and caching YouTube Analytics data for authenticated users.
 * GET returns cached analytics data, POST triggers a fresh fetch from YouTube Analytics API.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import {
  fetchYouTubeAnalytics,
  storeAnalyticsData,
  isYouTubeConnected,
  getDateRangeForLastNDays,
} from '@/lib/services/youtube'

// Cache GET responses for 15 minutes
export const revalidate = 900

/**
 * Default analytics period in days
 */
const DEFAULT_DAYS = 28

/**
 * GET /api/youtube/analytics
 * Returns cached YouTube analytics data for the authenticated user
 * 
 * Query params:
 * - days: Number of days to fetch (default: 28)
 * - startDate: Start date (YYYY-MM-DD) - overrides days
 * - endDate: End date (YYYY-MM-DD) - overrides days
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
    
    // Parse query parameters
    const url = new URL(request.url)
    const startDateParam = url.searchParams.get('startDate')
    const endDateParam = url.searchParams.get('endDate')
    const daysParam = url.searchParams.get('days')
    
    let startDate: string
    let endDate: string
    
    if (startDateParam && endDateParam) {
      // Use explicit date range
      startDate = startDateParam
      endDate = endDateParam
    } else {
      // Use days parameter or default
      const days = daysParam ? parseInt(daysParam, 10) : DEFAULT_DAYS
      if (isNaN(days) || days < 1 || days > 365) {
        return validationErrorResponse('Days must be between 1 and 365')
      }
      const range = getDateRangeForLastNDays(days)
      startDate = range.startDate
      endDate = range.endDate
    }
    
    // Fetch cached analytics data from database
    const { data: analyticsData, error: fetchError } = await supabase
      .from('youtube_analytics')
      .select('*')
      .eq('user_id', user.id)
      .eq('date_range_start', startDate)
      .eq('date_range_end', endDate)
      .single()
    
    if (fetchError) {
      // No analytics data cached yet - this is not an error condition
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          analytics: null,
          dateRange: { startDate, endDate },
          message: 'No analytics data cached for this date range. Use POST to fetch fresh data.',
        })
      }
      
      logError(fetchError, {
        route: 'GET /api/youtube/analytics',
        userId: user.id,
        operation: 'fetch-cached-analytics',
      })
      return databaseErrorResponse('Failed to fetch analytics data')
    }
    
    return NextResponse.json({
      success: true,
      analytics: {
        views: analyticsData.views,
        watchTimeMinutes: analyticsData.watch_time_minutes,
        averageViewDurationSeconds: analyticsData.average_view_duration_seconds,
        subscribersGained: analyticsData.subscribers_gained,
        subscribersLost: analyticsData.subscribers_lost,
        netSubscribers: analyticsData.subscribers_gained - analyticsData.subscribers_lost,
        likes: analyticsData.likes,
        dislikes: analyticsData.dislikes,
        comments: analyticsData.comments,
        shares: analyticsData.shares,
        estimatedRevenue: analyticsData.estimated_revenue,
        fetchedAt: analyticsData.fetched_at,
      },
      dateRange: {
        startDate: analyticsData.date_range_start,
        endDate: analyticsData.date_range_end,
      },
      channelId: analyticsData.channel_id,
    })
    
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'fetch-analytics-data', undefined, 'Failed to fetch analytics data')
  }
}

/**
 * POST /api/youtube/analytics
 * Fetches fresh analytics data from YouTube Analytics API and caches it
 * 
 * Body params:
 * - days: Number of days to fetch (default: 28)
 * - startDate: Start date (YYYY-MM-DD) - overrides days
 * - endDate: End date (YYYY-MM-DD) - overrides days
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    
    // Check if user has YouTube connected
    const connected = await isYouTubeConnected(user.id)
    if (!connected) {
      return NextResponse.json({
        success: false,
        error: 'YouTube not connected. Please connect your YouTube account first.',
        code: 'NOT_CONNECTED',
      }, { status: 400 })
    }
    
    // Parse request body
    let body: { days?: number; startDate?: string; endDate?: string } = {}
    try {
      const text = await request.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch {
      // Empty body is OK, will use defaults
    }
    
    let startDate: string
    let endDate: string
    
    if (body.startDate && body.endDate) {
      startDate = body.startDate
      endDate = body.endDate
    } else {
      const days = body.days || DEFAULT_DAYS
      if (days < 1 || days > 365) {
        return validationErrorResponse('Days must be between 1 and 365')
      }
      const range = getDateRangeForLastNDays(days)
      startDate = range.startDate
      endDate = range.endDate
    }
    
    // Get the user's channel ID first (we need it to store analytics)
    const { data: channelData } = await supabase
      .from('youtube_channels')
      .select('channel_id')
      .eq('user_id', user.id)
      .single()
    
    if (!channelData?.channel_id) {
      return NextResponse.json({
        success: false,
        error: 'No channel data found. Please fetch channel data first.',
        code: 'NO_CHANNEL_DATA',
      }, { status: 400 })
    }
    
    // Fetch fresh analytics data from YouTube API
    const { data: analyticsData, error: fetchError } = await fetchYouTubeAnalytics(
      user.id,
      startDate,
      endDate
    )
    
    if (fetchError || !analyticsData) {
      logError(new Error(fetchError || 'No analytics data returned'), {
        route: 'POST /api/youtube/analytics',
        userId: user.id,
        operation: 'fetch-youtube-analytics',
      })
      return NextResponse.json({
        success: false,
        error: fetchError || 'Failed to fetch analytics from YouTube',
        code: 'YOUTUBE_API_ERROR',
      }, { status: 400 })
    }
    
    // Store the analytics data in database
    const { error: storeError } = await storeAnalyticsData(
      user.id,
      channelData.channel_id,
      startDate,
      endDate,
      analyticsData
    )
    
    if (storeError) {
      logError(new Error(storeError), {
        route: 'POST /api/youtube/analytics',
        userId: user.id,
        operation: 'store-analytics-data',
      })
      // Still return the data even if storage failed
    }
    
    logInfo('YouTube analytics data fetched and cached', {
      route: 'POST /api/youtube/analytics',
      userId: user.id,
      dateRange: { startDate, endDate },
    })
    
    return NextResponse.json({
      success: true,
      analytics: {
        views: analyticsData.views,
        watchTimeMinutes: analyticsData.watchTimeMinutes,
        averageViewDurationSeconds: analyticsData.averageViewDurationSeconds,
        subscribersGained: analyticsData.subscribersGained,
        subscribersLost: analyticsData.subscribersLost,
        netSubscribers: analyticsData.subscribersGained - analyticsData.subscribersLost,
        likes: analyticsData.likes,
        dislikes: analyticsData.dislikes,
        comments: analyticsData.comments,
        shares: analyticsData.shares,
        estimatedRevenue: analyticsData.estimatedRevenue,
        fetchedAt: new Date().toISOString(),
      },
      dateRange: { startDate, endDate },
      channelId: channelData.channel_id,
      message: 'Analytics data fetched successfully',
    }, { status: 201 })
    
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'fetch-analytics-data', undefined, 'Failed to fetch analytics data')
  }
}
