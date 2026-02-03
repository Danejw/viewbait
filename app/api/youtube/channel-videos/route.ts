/**
 * YouTube Channel Videos API Route (proxy)
 *
 * Fetches public videos from any YouTube channel by channel ID or URL.
 * Uses YouTube Data API v3 with server-side API key (never exposed to client).
 * Supports video URL (resolved to channel) and channel URL (/channel/UC...).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  notFoundResponse,
  configErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import { LRUCache } from 'lru-cache'

// ============================================================================
// Constants
// ============================================================================

const YOUTUBE_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3'
const DEFAULT_MAX_RESULTS = 24
const MAX_RESULTS_CAP = 50

// Cache: 10 minutes per (channelId + pageToken)
interface CachedChannelVideos {
  videos: ChannelVideo[]
  nextPageToken: string | null
  hasMore: boolean
}

const channelVideosCache = new LRUCache<string, CachedChannelVideos>({
  max: 300,
  ttl: 10 * 60 * 1000, // 10 minutes
})

// ============================================================================
// Types
// ============================================================================

export interface ChannelVideo {
  videoId: string
  title: string
  publishedAt: string
  thumbnailUrl: string
  viewCount?: number
  likeCount?: number
  /** Duration in seconds (from contentDetails.duration). Used to classify Shorts (< 60s). */
  durationSeconds?: number
}

export interface ChannelVideosResponse {
  success: boolean
  videos: ChannelVideo[]
  nextPageToken: string | null
  hasMore: boolean
  count: number
}

// ============================================================================
// URL parsing: extract videoId or channelId from YouTube URL
// ============================================================================

/**
 * Parse YouTube URL to get videoId or channelId.
 * Returns { type: 'video', videoId } or { type: 'channel', channelId } or null if invalid.
 */
function parseYouTubeUrl(input: string): { type: 'video'; videoId: string } | { type: 'channel'; channelId: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    // If it looks like a raw channel ID (UC...)
    if (/^UC[\w-]{21,}$/i.test(trimmed)) {
      return { type: 'channel', channelId: trimmed }
    }

    let url: URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      url = new URL(trimmed)
    } else {
      url = new URL(`https://${trimmed}`)
    }

    const host = url.hostname.replace(/^www\./, '')
    if (host !== 'youtube.com' && host !== 'youtu.be') return null

    // youtu.be/VIDEO_ID
    if (host === 'youtu.be') {
      const videoId = url.pathname.slice(1).split('/')[0]
      if (videoId) return { type: 'video', videoId }
      return null
    }

    // youtube.com/watch?v=VIDEO_ID
    if (url.pathname === '/watch') {
      const videoId = url.searchParams.get('v')
      if (videoId) return { type: 'video', videoId }
      return null
    }

    // youtube.com/v/VIDEO_ID (legacy)
    const vMatch = url.pathname.match(/^\/v\/([\w-]+)/)
    if (vMatch) return { type: 'video', videoId: vMatch[1] }

    // youtube.com/channel/UCxxxx
    const channelMatch = url.pathname.match(/^\/channel\/(UC[\w-]{21,})/i)
    if (channelMatch) return { type: 'channel', channelId: channelMatch[1] }

    return null
  } catch {
    return null
  }
}

// ============================================================================
// YouTube API (with API key)
// ============================================================================

function buildApiUrl(path: string, params: Record<string, string>): string {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_DATA_API_KEY not configured')

  const url = new URL(`${YOUTUBE_DATA_API_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  url.searchParams.set('key', apiKey)
  return url.toString()
}

/** Get channelId from a video ID using videos.list(snippet). */
async function getChannelIdFromVideoId(videoId: string): Promise<string | null> {
  const url = buildApiUrl('/videos', {
    part: 'snippet',
    id: videoId,
  })
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    logError(new Error('YouTube API videos.list error'), {
      route: 'GET /api/youtube/channel-videos',
      operation: 'getChannelIdFromVideoId',
      status: res.status,
      error: (err as { error?: { message?: string } })?.error?.message,
    })
    return null
  }
  const data = (await res.json()) as { items?: Array<{ snippet?: { channelId?: string } }> }
  const channelId = data.items?.[0]?.snippet?.channelId ?? null
  return channelId
}

/** Get uploads playlist ID for a channel. */
async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  const url = buildApiUrl('/channels', {
    part: 'contentDetails',
    id: channelId,
  })
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    logError(new Error('YouTube API channels.list error'), {
      route: 'GET /api/youtube/channel-videos',
      operation: 'getUploadsPlaylistId',
      status: res.status,
      error: (err as { error?: { message?: string } })?.error?.message,
    })
    return null
  }
  const data = (await res.json()) as {
    items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>
  }
  const uploads = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null
  return uploads
}

/** Fetch playlist items (videos) with pagination. */
async function fetchPlaylistItems(
  playlistId: string,
  maxResults: number,
  pageToken?: string
): Promise<{
  videos: ChannelVideo[]
  nextPageToken: string | null
}> {
  const params: Record<string, string> = {
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: String(Math.min(maxResults, MAX_RESULTS_CAP)),
  }
  if (pageToken) params.pageToken = pageToken

  const url = buildApiUrl('/playlistItems', params)
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    logError(new Error('YouTube API playlistItems.list error'), {
      route: 'GET /api/youtube/channel-videos',
      operation: 'fetchPlaylistItems',
      status: res.status,
      error: (err as { error?: { message?: string } })?.error?.message,
    })
    return { videos: [], nextPageToken: null }
  }

  const data = (await res.json()) as {
    items?: Array<{
      contentDetails?: { videoId?: string }
      snippet?: { title?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> }
    }>
    nextPageToken?: string
  }

  const seenIds = new Set<string>()
  const videos: ChannelVideo[] = []
  for (const item of data.items ?? []) {
    const videoId = item.contentDetails?.videoId ?? ''
    if (!videoId || seenIds.has(videoId)) continue
    seenIds.add(videoId)
    const snippet = item.snippet ?? {}
    const thumbnails = snippet.thumbnails ?? {}
    const thumbnailUrl =
      thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? ''
    videos.push({
      videoId,
      title: snippet.title ?? 'Untitled',
      publishedAt: snippet.publishedAt ?? '',
      thumbnailUrl,
    })
  }

  return {
    videos,
    nextPageToken: data.nextPageToken ?? null,
  }
}

/**
 * Parse YouTube ISO 8601 duration (e.g. PT1M30S, PT45S) to total seconds.
 * Returns 0 for missing or invalid input.
 */
function parseDurationSeconds(isoDuration: string | null | undefined): number {
  if (!isoDuration || typeof isoDuration !== 'string') return 0
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i)
  if (!match) return 0
  const hours = parseInt(match[1] ?? '0', 10)
  const minutes = parseInt(match[2] ?? '0', 10)
  const seconds = parseInt(match[3] ?? '0', 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return 0
  return hours * 3600 + minutes * 60 + seconds
}

/** Attach viewCount, likeCount, and durationSeconds via videos.list(statistics,contentDetails). */
async function attachVideoStatisticsAndDuration(videos: ChannelVideo[]): Promise<ChannelVideo[]> {
  if (videos.length === 0) return videos

  const ids = videos.map((v) => v.videoId).join(',')
  const url = buildApiUrl('/videos', {
    part: 'statistics,contentDetails',
    id: ids,
  })
  const res = await fetch(url)
  if (!res.ok) return videos

  const data = (await res.json()) as {
    items?: Array<{
      id?: string
      statistics?: { viewCount?: string; likeCount?: string }
      contentDetails?: { duration?: string }
    }>
  }

  const byId = new Map<string, { viewCount: number; likeCount: number; durationSeconds: number }>()
  for (const item of data.items ?? []) {
    const id = item.id
    if (!id) continue
    const viewCount = item.statistics?.viewCount != null ? parseInt(item.statistics.viewCount, 10) : 0
    const likeCount = item.statistics?.likeCount != null ? parseInt(item.statistics.likeCount, 10) : 0
    const durationSeconds = parseDurationSeconds(item.contentDetails?.duration)
    byId.set(id, {
      viewCount: Number.isNaN(viewCount) ? 0 : viewCount,
      likeCount: Number.isNaN(likeCount) ? 0 : likeCount,
      durationSeconds,
    })
  }

  return videos.map((v) => {
    const extra = byId.get(v.videoId)
    return extra
      ? { ...v, viewCount: extra.viewCount, likeCount: extra.likeCount, durationSeconds: extra.durationSeconds }
      : v
  })
}

// ============================================================================
// Handler
// ============================================================================

/**
 * GET /api/youtube/channel-videos
 * Query: url (YouTube video or channel URL) OR channelId, pageToken?, maxResults?
 * Returns paginated public videos for that channel. Requires auth.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    await requireAuth(supabase)

    if (!process.env.YOUTUBE_DATA_API_KEY) {
      return configErrorResponse('YouTube Data API key not configured. Set YOUTUBE_DATA_API_KEY.')
    }

    const { searchParams } = new URL(request.url)
    const urlParam = searchParams.get('url')?.trim() ?? ''
    const channelIdParam = searchParams.get('channelId')?.trim() ?? ''
    const pageToken = searchParams.get('pageToken') ?? undefined
    const maxResultsParam = searchParams.get('maxResults')
    const maxResults = Math.min(
      Math.max(1, parseInt(maxResultsParam ?? String(DEFAULT_MAX_RESULTS), 10) || DEFAULT_MAX_RESULTS),
      MAX_RESULTS_CAP
    )

    let channelId: string | null = null

    if (channelIdParam) {
      if (!/^UC[\w-]{21,}$/i.test(channelIdParam)) {
        return validationErrorResponse('Invalid channel ID format. Use a channel ID like UC...')
      }
      channelId = channelIdParam
    } else if (urlParam) {
      const parsed = parseYouTubeUrl(urlParam)
      if (!parsed) {
        return validationErrorResponse(
          'Invalid YouTube URL. Use a video URL (youtube.com/watch?v=... or youtu.be/...) or channel URL (youtube.com/channel/UC...).'
        )
      }
      if (parsed.type === 'channel') {
        channelId = parsed.channelId
      } else {
        channelId = await getChannelIdFromVideoId(parsed.videoId)
        if (!channelId) {
          return notFoundResponse('Video not found or not accessible.')
        }
      }
    } else {
      return validationErrorResponse('Provide either url or channelId.')
    }

    const cacheKey = `channel:${channelId}:page:${pageToken ?? 'first'}:max:${maxResults}`
    if (!pageToken) {
      const cached = channelVideosCache.get(cacheKey)
      if (cached) {
        logInfo('Returning cached channel videos', {
          route: 'GET /api/youtube/channel-videos',
          channelId,
          count: cached.videos.length,
        })
        return NextResponse.json({
          success: true,
          videos: cached.videos,
          nextPageToken: cached.nextPageToken,
          hasMore: cached.hasMore,
          count: cached.videos.length,
        })
      }
    }

    const playlistId = await getUploadsPlaylistId(channelId)
    if (!playlistId) {
      return notFoundResponse('Channel not found or has no uploads.')
    }

    const { videos, nextPageToken } = await fetchPlaylistItems(playlistId, maxResults, pageToken)
    const videosWithStats = await attachVideoStatisticsAndDuration(videos)

    const result: CachedChannelVideos = {
      videos: videosWithStats,
      nextPageToken,
      hasMore: !!nextPageToken,
    }
    if (!pageToken) {
      channelVideosCache.set(cacheKey, result)
    }

    logInfo('Fetched channel videos', {
      route: 'GET /api/youtube/channel-videos',
      channelId,
      count: videosWithStats.length,
      hasMore: result.hasMore,
    })

    return NextResponse.json({
      success: true,
      videos: result.videos,
      nextPageToken: result.nextPageToken,
      hasMore: result.hasMore,
      count: result.videos.length,
    })
  } catch (error) {
    return handleApiError(error, 'GET /api/youtube/channel-videos', 'channel-videos', undefined, 'Failed to fetch channel videos')
  }
}
