/**
 * YouTube Video by ID API Route
 * 
 * Fetches a single video's details by video ID.
 * Used when a specific video isn't in the latest videos list.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/server/utils/error-handler'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import {
  ensureValidToken,
  isYouTubeConnected,
  fetchVideoDetailsFromDataAPI,
} from '@/lib/services/youtube'

export interface YouTubeVideoResponse {
  videoId: string
  title: string
  publishedAt: string
  thumbnailUrl: string
  description?: string
  tags?: string[]
  viewCount?: number
  likeCount?: number
  commentCount?: number
}

/**
 * GET /api/youtube/videos/[id]
 * Get a single video by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id: videoId } = await params

    // Check if user has YouTube connected
    const connected = await isYouTubeConnected(user.id)
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
    const accessToken = await ensureValidToken(user.id)
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

    // Fetch video details from YouTube Data API
    const videoDetails = await fetchVideoDetailsFromDataAPI(videoId, accessToken)

    if (!videoDetails) {
      return notFoundResponse('Video not found or access denied')
    }

    const response: YouTubeVideoResponse = {
      videoId: videoDetails.videoId,
      title: videoDetails.title,
      publishedAt: videoDetails.publishedAt,
      thumbnailUrl: videoDetails.thumbnailUrl,
      description: videoDetails.description,
      tags: videoDetails.tags,
      viewCount: videoDetails.viewCount,
      likeCount: videoDetails.likeCount,
      commentCount: videoDetails.commentCount,
    }

    logInfo('Fetched video by ID', {
      route: 'GET /api/youtube/videos/[id]',
      userId: user.id,
      videoId,
    })

    return NextResponse.json({
      success: true,
      video: response,
    })
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to fetch video')
  }
}
