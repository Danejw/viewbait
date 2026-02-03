/**
 * YouTube Video Set Thumbnail API Route
 * 
 * Uploads and sets a custom thumbnail for a YouTube video.
 * Requires youtube.upload scope.
 * Validates file constraints (max 2MB; jpeg/png).
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
const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png']

export interface SetThumbnailRequest {
  image_url: string
}

/**
 * POST /api/youtube/videos/[id]/set-thumbnail
 * Set a custom thumbnail for a YouTube video
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
    const body: SetThumbnailRequest = await request.json()

    if (!body.image_url || !body.image_url.trim()) {
      return validationErrorResponse('image_url is required')
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

    // Fetch the image from the URL
    let imageResponse: Response
    try {
      imageResponse = await fetch(body.image_url)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
      }
    } catch (error) {
      logError(error, {
        route: 'POST /api/youtube/videos/[id]/set-thumbnail',
        userId: user.id,
        videoId,
        operation: 'fetch-image',
      })
      return validationErrorResponse('Failed to fetch image from URL')
    }

    // Validate file size
    const contentLength = imageResponse.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_THUMBNAIL_SIZE) {
      return validationErrorResponse(
        `Image size exceeds 2MB limit (${Math.round(parseInt(contentLength, 10) / 1024 / 1024 * 100) / 100}MB)`
      )
    }

    // Get image data
    const imageBuffer = await imageResponse.arrayBuffer()
    const imageSize = imageBuffer.byteLength

    if (imageSize > MAX_THUMBNAIL_SIZE) {
      return validationErrorResponse(
        `Image size exceeds 2MB limit (${Math.round(imageSize / 1024 / 1024 * 100) / 100}MB)`
      )
    }

    // Validate MIME type
    const contentType = imageResponse.headers.get('content-type') || ''
    if (!ALLOWED_MIME_TYPES.includes(contentType.toLowerCase())) {
      // Try to detect from file extension if content-type is missing
      const urlLower = body.image_url.toLowerCase()
      const isJpeg = urlLower.includes('.jpg') || urlLower.includes('.jpeg')
      const isPng = urlLower.includes('.png')

      if (!isJpeg && !isPng) {
        return validationErrorResponse(
          'Image must be JPEG or PNG format'
        )
      }
    }

    // Determine MIME type for upload
    let mimeType = contentType
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      const urlLower = body.image_url.toLowerCase()
      mimeType = urlLower.includes('.png') ? 'image/png' : 'image/jpeg'
    }

    // Upload thumbnail to YouTube using thumbnails.set
    const uploadUrl = new URL(`${YOUTUBE_DATA_API_BASE}/thumbnails/set`)
    uploadUrl.searchParams.set('videoId', videoId)

    // YouTube thumbnails.set requires multipart/form-data
    const formData = new FormData()
    const blob = new Blob([imageBuffer], { type: mimeType })
    formData.append('media', blob)

    const uploadResponse = await fetch(uploadUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Don't set Content-Type header - browser will set it with boundary
      },
      body: formData,
    })

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}))
      logError(new Error('YouTube API error'), {
        route: 'POST /api/youtube/videos/[id]/set-thumbnail',
        userId: user.id,
        videoId,
        status: uploadResponse.status,
        error: errorData.error?.message || uploadResponse.statusText,
      })
      return NextResponse.json(
        {
          success: false,
          error: errorData.error?.message || 'Failed to upload thumbnail',
          code: 'YOUTUBE_API_ERROR',
        },
        { status: uploadResponse.status }
      )
    }

    const uploadData = await uploadResponse.json().catch(() => ({}))

    logInfo('Video thumbnail set successfully', {
      route: 'POST /api/youtube/videos/[id]/set-thumbnail',
      userId: user.id,
      videoId,
      imageSize,
      mimeType,
    })

    return NextResponse.json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      data: uploadData,
    })
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'set-video-thumbnail', undefined, 'Failed to set video thumbnail')
  }
}
