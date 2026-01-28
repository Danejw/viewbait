/**
 * YouTube Channel API Route
 * 
 * Handles fetching and caching YouTube channel data for authenticated users.
 * GET returns cached channel data, POST triggers a fresh fetch from YouTube API.
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
  fetchYouTubeChannel,
  storeChannelData,
  isYouTubeConnected,
} from '@/lib/services/youtube'

// Cache GET responses for 5 minutes
export const revalidate = 300

/**
 * GET /api/youtube/channel
 * Returns cached YouTube channel data for the authenticated user
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
    
    // Fetch cached channel data from database
    const { data: channelData, error: fetchError } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (fetchError) {
      // No channel data cached yet - this is not an error condition
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          channel: null,
          message: 'No channel data cached. Use POST to fetch fresh data.',
        })
      }
      
      logError(fetchError, {
        route: 'GET /api/youtube/channel',
        userId: user.id,
        operation: 'fetch-cached-channel',
      })
      return databaseErrorResponse('Failed to fetch channel data')
    }
    
    return NextResponse.json({
      success: true,
      channel: {
        channelId: channelData.channel_id,
        title: channelData.title,
        description: channelData.description,
        customUrl: channelData.custom_url,
        thumbnailUrl: channelData.thumbnail_url,
        subscriberCount: channelData.subscriber_count,
        videoCount: channelData.video_count,
        viewCount: channelData.view_count,
        publishedAt: channelData.published_at,
        country: channelData.country,
        fetchedAt: channelData.fetched_at,
      },
    })
    
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to fetch channel data')
  }
}

/**
 * POST /api/youtube/channel
 * Fetches fresh channel data from YouTube API and caches it
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
    
    // Fetch fresh channel data from YouTube API
    const { data: channelData, error: fetchError } = await fetchYouTubeChannel(user.id)
    
    if (fetchError || !channelData) {
      logError(new Error(fetchError || 'No channel data returned'), {
        route: 'POST /api/youtube/channel',
        userId: user.id,
        operation: 'fetch-youtube-channel',
      })
      return NextResponse.json({
        success: false,
        error: fetchError || 'Failed to fetch channel from YouTube',
        code: 'YOUTUBE_API_ERROR',
      }, { status: 400 })
    }
    
    // Store the channel data in database
    const { error: storeError } = await storeChannelData(user.id, channelData)
    
    if (storeError) {
      logError(new Error(storeError), {
        route: 'POST /api/youtube/channel',
        userId: user.id,
        operation: 'store-channel-data',
      })
      // Still return the data even if storage failed
      logInfo('Channel data fetched but storage failed', {
        route: 'POST /api/youtube/channel',
        userId: user.id,
      })
    }
    
    logInfo('YouTube channel data fetched and cached', {
      route: 'POST /api/youtube/channel',
      userId: user.id,
      channelId: channelData.channelId,
    })
    
    return NextResponse.json({
      success: true,
      channel: {
        channelId: channelData.channelId,
        title: channelData.title,
        description: channelData.description,
        customUrl: channelData.customUrl,
        thumbnailUrl: channelData.thumbnailUrl,
        subscriberCount: channelData.subscriberCount,
        videoCount: channelData.videoCount,
        viewCount: channelData.viewCount,
        publishedAt: channelData.publishedAt,
        country: channelData.country,
        fetchedAt: new Date().toISOString(),
      },
      message: 'Channel data fetched successfully',
    }, { status: 201 })
    
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to fetch channel data')
  }
}
