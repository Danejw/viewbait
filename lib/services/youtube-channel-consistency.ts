/**
 * YouTube Channel Consistency Service
 *
 * Client-side fetcher for the channel-consistency API.
 * Returns typed score and cues for a thumbnail compared to the rest of the channel.
 */

export interface ChannelConsistencyResponse {
  score: number
  cues: string[]
}

export interface ChannelConsistencyRequest {
  videoId: string
  thumbnailUrl: string
  otherThumbnailUrls: string[]
}

/**
 * Check how consistent a video's thumbnail is with the rest of the channel.
 * Requires auth and YouTube connected. otherThumbnailUrls must be non-empty.
 */
export async function checkChannelConsistency(
  payload: ChannelConsistencyRequest
): Promise<ChannelConsistencyResponse> {
  const res = await fetch('/api/youtube/channel-consistency', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const message = (data?.error as string) || res.statusText || 'Failed to check channel consistency'
    throw new Error(message)
  }

  return res.json() as Promise<ChannelConsistencyResponse>
}
