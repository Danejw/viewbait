/**
 * YouTube Video Set Thumbnail API Route
 *
 * Sets a custom thumbnail for a YouTube video. Delegates to setVideoThumbnailFromUrl.
 * Accepts either thumbnail_id (server resolves image URL) or image_url.
 * Requires youtube.force-ssl (or youtube.upload) scope. Returns SCOPE_REQUIRED on 403 scope errors.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { validationErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import {
  hasThumbnailScope,
  isYouTubeConnected,
  setVideoThumbnailFromUrl,
} from '@/lib/services/youtube'
import { recordPromotion } from '@/lib/services/live-thumbnail'

/** Short-lived signed URL expiry (seconds) when resolving thumbnail_id for one-time fetch. */
const THUMBNAIL_SIGNED_URL_EXPIRY_SECONDS = 60

export interface SetThumbnailRequest {
  /** Preferred: server loads thumbnail with RLS and resolves image URL. */
  thumbnail_id?: string
  /** Alternative: client provides a fetchable image URL (e.g. long-lived signed URL). */
  image_url?: string
  /** Optional video title for the live period row (human-readable in thumbnail details). */
  video_title?: string
}

/**
 * POST /api/youtube/videos/[id]/set-thumbnail
 * Set a custom thumbnail for a YouTube video. Body: { thumbnail_id } or { image_url }.
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

    const hasScope = await hasThumbnailScope(user.id)
    if (!hasScope) {
      logInfo('Set thumbnail blocked: no thumbnail scope; suggest Reconnect', {
        route: 'POST /api/youtube/videos/[id]/set-thumbnail',
        userId: user.id,
      })
      return NextResponse.json(
        {
          success: false,
          error:
            'Thumbnail upload requires extra permission. Click Reconnect in the YouTube tab to sign in with Google again and grant it.',
          code: 'SCOPE_REQUIRED',
        },
        { status: 403 }
      )
    }

    const body = (await request.json()) as SetThumbnailRequest
    const thumbnailId = body.thumbnail_id?.trim()
    const imageUrl = body.image_url?.trim()

    if (!thumbnailId && !imageUrl) {
      return validationErrorResponse('thumbnail_id or image_url is required')
    }

    let resolvedImageUrl: string

    if (thumbnailId) {
      const { data: thumbnail, error: thumbError } = await supabase
        .from('thumbnails')
        .select('id, image_url')
        .eq('id', thumbnailId)
        .eq('user_id', user.id)
        .single()

      if (thumbError || !thumbnail) {
        return NextResponse.json(
          { success: false, error: 'Thumbnail not found', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }

      let storagePath: string | null = null
      if (thumbnail.image_url) {
        const signedUrlMatch = (thumbnail.image_url as string).match(
          /\/storage\/v1\/object\/sign\/thumbnails\/([^?]+)/
        )
        if (signedUrlMatch) storagePath = signedUrlMatch[1]
      }
      if (!storagePath) {
        storagePath = `${user.id}/${thumbnail.id}/thumbnail.png`
      }

      const { data: signedUrlData } = await supabase.storage
        .from('thumbnails')
        .createSignedUrl(storagePath, THUMBNAIL_SIGNED_URL_EXPIRY_SECONDS)

      let signedUrl = signedUrlData?.signedUrl ?? null
      if (!signedUrl && storagePath.endsWith('.png')) {
        const jpgPath = storagePath.replace('.png', '.jpg')
        const { data: jpgData } = await supabase.storage
          .from('thumbnails')
          .createSignedUrl(jpgPath, THUMBNAIL_SIGNED_URL_EXPIRY_SECONDS)
        signedUrl = jpgData?.signedUrl ?? null
      }

      if (!signedUrl) {
        logError(new Error('Failed to create signed URL for thumbnail'), {
          route: 'POST /api/youtube/videos/[id]/set-thumbnail',
          userId: user.id,
          thumbnailId,
        })
        return NextResponse.json(
          { success: false, error: 'Could not resolve thumbnail image', code: 'RESOLVE_FAILED' },
          { status: 500 }
        )
      }
      resolvedImageUrl = signedUrl
    } else {
      resolvedImageUrl = imageUrl!
    }

    const result = await setVideoThumbnailFromUrl(user.id, videoId, resolvedImageUrl)

    if (result.success) {
      if (thumbnailId) {
        const videoTitle = body.video_title?.trim() || undefined
        try {
          await recordPromotion(supabase, user.id, thumbnailId, videoId, videoTitle)
        } catch (err) {
          logError(err instanceof Error ? err : new Error(String(err)), {
            route: 'POST /api/youtube/videos/[id]/set-thumbnail',
            userId: user.id,
            videoId,
            thumbnailId,
          })
          // Do not fail the response: thumbnail was set successfully
        }
      }
      logInfo('Video thumbnail set successfully', {
        route: 'POST /api/youtube/videos/[id]/set-thumbnail',
        userId: user.id,
        videoId,
      })
      return NextResponse.json({
        success: true,
        message: 'Thumbnail uploaded successfully',
      })
    }

    if (result.code === 'SCOPE_REQUIRED') {
      return NextResponse.json(
        {
          success: false,
          error:
            result.error ||
            'Thumbnail upload requires an extra permission. Reconnect your YouTube account to enable it.',
          code: 'SCOPE_REQUIRED',
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error || 'Failed to upload thumbnail',
        code: 'YOUTUBE_API_ERROR',
      },
      { status: 403 }
    )
  } catch (error) {
    return handleApiError(
      error,
      'UNKNOWN',
      'set-video-thumbnail',
      undefined,
      'Failed to set video thumbnail'
    )
  }
}
