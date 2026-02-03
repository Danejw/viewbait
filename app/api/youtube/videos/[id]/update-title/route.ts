/**
 * YouTube Video Update Title API Route
 * 
 * Updates a YouTube video's title using the YouTube Data API.
 * Requires youtube.force-ssl scope.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import {
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import { ensureValidToken, isYouTubeConnected } from '@/lib/services/youtube'

const YOUTUBE_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3'

export interface UpdateTitleRequest {
  title: string
}

/**
 * POST /api/youtube/videos/[id]/update-title
 * Update a YouTube video's title
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id: videoId } = await params

    const tierName = await getTierNameForUser(supabase, user.id)
    if (tierName !== 'pro') {
      return NextResponse.json(
        {
          success: false,
          error: 'YouTube integration is available on the Pro plan.',
          code: 'TIER_REQUIRED',
        },
        { status: 403 }
      )
    }

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

    // Parse request body
    const body: UpdateTitleRequest = await request.json()

    if (!body.title || !body.title.trim()) {
      return validationErrorResponse('title is required')
    }

    // Validate title length (YouTube limit is 100 characters)
    if (body.title.length > 100) {
      return validationErrorResponse('Title must be 100 characters or less')
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

    // First, fetch the full video resource to get all required fields
    const fetchUrl = new URL(`${YOUTUBE_DATA_API_BASE}/videos`)
    fetchUrl.searchParams.set('part', 'snippet,status')
    fetchUrl.searchParams.set('id', videoId)

    const fetchResponse = await fetch(fetchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.json()
      logError(new Error('YouTube API error'), {
        route: 'POST /api/youtube/videos/[id]/update-title',
        userId: user.id,
        videoId,
        status: fetchResponse.status,
        error: errorData.error?.message,
      })
      return NextResponse.json(
        {
          success: false,
          error: errorData.error?.message || 'Failed to fetch video',
          code: 'YOUTUBE_API_ERROR',
        },
        { status: fetchResponse.status }
      )
    }

    const fetchData = await fetchResponse.json()

    if (!fetchData.items || fetchData.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Video not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    const video = fetchData.items[0]

    // Update only the title, keeping all other fields
    const updateUrl = new URL(`${YOUTUBE_DATA_API_BASE}/videos`)
    updateUrl.searchParams.set('part', 'snippet')

    const updateBody = {
      id: videoId,
      snippet: {
        ...video.snippet,
        title: body.title.trim(),
      },
    }

    const updateResponse = await fetch(updateUrl.toString(), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateBody),
    })

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json()
      logError(new Error('YouTube API error'), {
        route: 'POST /api/youtube/videos/[id]/update-title',
        userId: user.id,
        videoId,
        status: updateResponse.status,
        error: errorData.error?.message,
      })
      return NextResponse.json(
        {
          success: false,
          error: errorData.error?.message || 'Failed to update video title',
          code: 'YOUTUBE_API_ERROR',
        },
        { status: updateResponse.status }
      )
    }

    const updateData = await updateResponse.json()

    logInfo('Video title updated successfully', {
      route: 'POST /api/youtube/videos/[id]/update-title',
      userId: user.id,
      videoId,
      newTitle: body.title,
    })

    return NextResponse.json({
      success: true,
      video: updateData.items?.[0],
    })
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'update-video-title', undefined, 'Failed to update video title')
  }
}
