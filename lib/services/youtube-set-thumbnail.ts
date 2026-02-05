/**
 * YouTube Set Thumbnail Service
 *
 * Client-side API for setting a video's thumbnail on YouTube.
 * Handles thumbnail_id (preferred) or image_url; returns structured result for SCOPE_REQUIRED, etc.
 */

export type SetVideoThumbnailResult =
  | { success: true }
  | {
      success: false
      error: string
      code: 'SCOPE_REQUIRED' | 'TIER_REQUIRED' | 'NOT_CONNECTED' | 'TOKEN_ERROR' | 'YOUTUBE_API_ERROR' | 'NOT_FOUND' | 'RESOLVE_FAILED'
      /** When SCOPE_REQUIRED: exact URL to add to GCP Authorized redirect URIs. */
      redirect_uri_hint?: string
    }

export interface SetVideoThumbnailParams {
  /** Preferred: server resolves image from thumbnail row. */
  thumbnail_id?: string
  /** Alternative: fetchable image URL. */
  image_url?: string
}

/**
 * Set a YouTube video's thumbnail. Use thumbnail_id when available (e.g. from picker).
 * On SCOPE_REQUIRED, show reconnect CTA. On TIER_REQUIRED / NOT_CONNECTED, use existing patterns.
 */
export async function setVideoThumbnail(
  videoId: string,
  params: SetVideoThumbnailParams
): Promise<SetVideoThumbnailResult> {
  const body: Record<string, string> = {}
  if (params.thumbnail_id) body.thumbnail_id = params.thumbnail_id
  else if (params.image_url) body.image_url = params.image_url
  else return { success: false, error: 'thumbnail_id or image_url required', code: 'YOUTUBE_API_ERROR' }

  const res = await fetch(`/api/youtube/videos/${encodeURIComponent(videoId)}/set-thumbnail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))

  if (res.ok && data.success) {
    return { success: true }
  }

  const codeList = [
    'SCOPE_REQUIRED',
    'TIER_REQUIRED',
    'NOT_CONNECTED',
    'TOKEN_ERROR',
    'YOUTUBE_API_ERROR',
    'NOT_FOUND',
    'RESOLVE_FAILED',
  ] as const
  const code = codeList.includes(data.code as (typeof codeList)[number])
    ? (data.code as (typeof codeList)[number])
    : 'YOUTUBE_API_ERROR'

  return {
    success: false,
    error: (data.error as string) || res.statusText || 'Failed to set thumbnail',
    code,
    ...(data.redirect_uri_hint != null && { redirect_uri_hint: String(data.redirect_uri_hint) }),
  }
}
