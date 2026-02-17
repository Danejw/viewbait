import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { validationErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import { ensureValidToken, isYouTubeConnected } from '@/lib/services/youtube'

const YOUTUBE_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3'

interface UpdateDescriptionRequest {
  description: string
}

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
      return NextResponse.json({ success: false, error: 'YouTube integration is available on the Pro plan.', code: 'TIER_REQUIRED' }, { status: 403 })
    }

    const connected = await isYouTubeConnected(user.id)
    if (!connected) {
      return NextResponse.json({ success: false, error: 'YouTube not connected', code: 'NOT_CONNECTED' }, { status: 404 })
    }

    const body: UpdateDescriptionRequest = await request.json()
    const description = typeof body.description === 'string' ? body.description.trim() : ''

    if (!description) return validationErrorResponse('description is required')
    if (description.length > 5000) return validationErrorResponse('Description must be 5000 characters or less')

    const accessToken = await ensureValidToken(user.id)
    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'Unable to get valid access token', code: 'TOKEN_ERROR' }, { status: 401 })
    }

    const fetchUrl = new URL(`${YOUTUBE_DATA_API_BASE}/videos`)
    fetchUrl.searchParams.set('part', 'snippet,status')
    fetchUrl.searchParams.set('id', videoId)

    const fetchResponse = await fetch(fetchUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!fetchResponse.ok) {
      const errorData = await fetchResponse.json()
      logError(new Error('YouTube API error'), {
        route: 'POST /api/youtube/videos/[id]/update-description',
        userId: user.id,
        videoId,
        status: fetchResponse.status,
        error: errorData.error?.message,
      })
      return NextResponse.json({ success: false, error: errorData.error?.message || 'Failed to fetch video', code: 'YOUTUBE_API_ERROR' }, { status: fetchResponse.status })
    }

    const fetchData = await fetchResponse.json()
    if (!fetchData.items || fetchData.items.length === 0) {
      return NextResponse.json({ success: false, error: 'Video not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const video = fetchData.items[0]
    const updateUrl = new URL(`${YOUTUBE_DATA_API_BASE}/videos`)
    updateUrl.searchParams.set('part', 'snippet')

    const updateResponse = await fetch(updateUrl.toString(), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: videoId,
        snippet: {
          ...video.snippet,
          description,
        },
      }),
    })

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json()
      logError(new Error('YouTube API error'), {
        route: 'POST /api/youtube/videos/[id]/update-description',
        userId: user.id,
        videoId,
        status: updateResponse.status,
        error: errorData.error?.message,
      })
      return NextResponse.json({ success: false, error: errorData.error?.message || 'Failed to update video description', code: 'YOUTUBE_API_ERROR' }, { status: updateResponse.status })
    }

    const updateData = await updateResponse.json()

    logInfo('Video description updated successfully', {
      route: 'POST /api/youtube/videos/[id]/update-description',
      userId: user.id,
      videoId,
    })

    return NextResponse.json({ success: true, video: updateData.items?.[0] })
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'update-video-description', undefined, 'Failed to update video description')
  }
}
