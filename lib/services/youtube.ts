/**
 * YouTube Service
 * 
 * Server-side service for interacting with YouTube APIs.
 * Handles token management, channel data fetching, and analytics retrieval.
 * 
 * IMPORTANT: This service should only be used server-side.
 * It accesses sensitive tokens via service role.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { logError, logInfo, logWarn } from '@/lib/server/utils/logger'

// ============================================================================
// Constants
// ============================================================================

const YOUTUBE_DATA_API_BASE = 'https://www.googleapis.com/youtube/v3'
const YOUTUBE_ANALYTICS_API_BASE = 'https://youtubeanalytics.googleapis.com/v2'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// Token refresh buffer - refresh if expiring within 5 minutes
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

// ============================================================================
// Types
// ============================================================================

export interface YouTubeIntegration {
  id: string
  user_id: string
  google_user_id: string | null
  access_token: string
  refresh_token: string | null
  expires_at: string
  scopes_granted: string[]
  is_connected: boolean
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface YouTubeChannelData {
  channelId: string
  title: string
  description: string
  customUrl: string | null
  thumbnailUrl: string | null
  subscriberCount: number | null
  videoCount: number
  viewCount: number
  publishedAt: string | null
  country: string | null
}

export interface YouTubeAnalyticsData {
  views: number
  watchTimeMinutes: number
  averageViewDurationSeconds: number
  subscribersGained: number
  subscribersLost: number
  likes: number
  dislikes: number
  comments: number
  shares: number
  estimatedRevenue: number | null
}

export interface TokenRefreshResult {
  success: boolean
  accessToken?: string
  expiresIn?: number
  error?: string
  errorCode?: string
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Get the YouTube integration for a user
 * Returns null if no integration exists or it's disconnected
 */
export async function getYouTubeIntegration(
  userId: string
): Promise<YouTubeIntegration | null> {
  const supabaseService = createServiceClient()
  
  const { data, error } = await supabaseService
    .from('youtube_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_connected', true)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data as YouTubeIntegration
}

/**
 * Refresh Google OAuth access token using the refresh token
 */
async function refreshGoogleToken(refreshToken: string): Promise<TokenRefreshResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'Google OAuth credentials not configured',
      errorCode: 'MISSING_CREDENTIALS',
    }
  }
  
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      
      if (errorData.error === 'invalid_grant') {
        return {
          success: false,
          error: 'Refresh token has been revoked or expired',
          errorCode: 'INVALID_GRANT',
        }
      }
      
      return {
        success: false,
        error: errorData.error_description || errorData.error,
        errorCode: errorData.error,
      }
    }
    
    const data = await response.json()
    
    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      errorCode: 'NETWORK_ERROR',
    }
  }
}

/**
 * Ensure we have a valid access token for the user
 * Refreshes the token if it's expired or about to expire
 * 
 * @returns Valid access token or null if unable to get one
 */
export async function ensureValidToken(userId: string): Promise<string | null> {
  const integration = await getYouTubeIntegration(userId)
  
  if (!integration) {
    logWarn('No YouTube integration found for user', {
      service: 'youtube',
      operation: 'ensureValidToken',
      userId,
    })
    return null
  }
  
  const expiresAt = new Date(integration.expires_at)
  const needsRefresh = expiresAt.getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS
  
  if (!needsRefresh) {
    return integration.access_token
  }
  
  // Token needs refresh
  if (!integration.refresh_token) {
    logWarn('No refresh token available', {
      service: 'youtube',
      operation: 'ensureValidToken',
      userId,
    })
    return null
  }
  
  const refreshResult = await refreshGoogleToken(integration.refresh_token)
  
  if (!refreshResult.success || !refreshResult.accessToken) {
    logError(new Error(refreshResult.error || 'Token refresh failed'), {
      service: 'youtube',
      operation: 'ensureValidToken',
      userId,
      errorCode: refreshResult.errorCode,
    })

    // Mark integration as disconnected when refresh fails with grant/client errors
    // so the UI shows "Connect YouTube" and the user can re-authorize.
    const shouldDisconnect =
      refreshResult.errorCode === 'INVALID_GRANT' ||
      refreshResult.errorCode === 'unauthorized_client'
    if (shouldDisconnect) {
      const supabaseService = createServiceClient()
      await supabaseService
        .from('youtube_integrations')
        .update({
          is_connected: false,
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
    }

    return null
  }
  
  // Update the stored token
  const supabaseService = createServiceClient()
  const newExpiresAt = new Date(
    Date.now() + (refreshResult.expiresIn || 3600) * 1000
  ).toISOString()
  
  await supabaseService
    .from('youtube_integrations')
    .update({
      access_token: refreshResult.accessToken,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  
  logInfo('YouTube access token refreshed', {
    service: 'youtube',
    operation: 'ensureValidToken',
    userId,
  })
  
  return refreshResult.accessToken
}

// ============================================================================
// YouTube Data API
// ============================================================================

/**
 * Fetch the authenticated user's YouTube channel
 * Uses the "mine=true" parameter to get the channel owned by the token holder
 */
export async function fetchYouTubeChannel(
  userId: string
): Promise<{ data: YouTubeChannelData | null; error: string | null }> {
  const accessToken = await ensureValidToken(userId)
  
  if (!accessToken) {
    return { data: null, error: 'Unable to get valid access token' }
  }
  
  try {
    const url = new URL(`${YOUTUBE_DATA_API_BASE}/channels`)
    url.searchParams.set('part', 'snippet,statistics,brandingSettings')
    url.searchParams.set('mine', 'true')
    
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      logError(new Error('YouTube API error'), {
        service: 'youtube',
        operation: 'fetchYouTubeChannel',
        userId,
        status: response.status,
        error: errorData.error?.message,
      })
      return { data: null, error: errorData.error?.message || 'YouTube API error' }
    }
    
    const data = await response.json()
    
    if (!data.items || data.items.length === 0) {
      return { data: null, error: 'No channel found for this account' }
    }
    
    const channel = data.items[0]
    const snippet = channel.snippet || {}
    const statistics = channel.statistics || {}
    
    const channelData: YouTubeChannelData = {
      channelId: channel.id,
      title: snippet.title || '',
      description: snippet.description || '',
      customUrl: snippet.customUrl || null,
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null,
      subscriberCount: statistics.hiddenSubscriberCount 
        ? null 
        : parseInt(statistics.subscriberCount || '0', 10),
      videoCount: parseInt(statistics.videoCount || '0', 10),
      viewCount: parseInt(statistics.viewCount || '0', 10),
      publishedAt: snippet.publishedAt || null,
      country: snippet.country || null,
    }
    
    return { data: channelData, error: null }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchYouTubeChannel',
      userId,
    })
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Failed to fetch channel' 
    }
  }
}

/**
 * Store channel data in the database
 */
export async function storeChannelData(
  userId: string,
  channelData: YouTubeChannelData
): Promise<{ success: boolean; error: string | null }> {
  const supabaseService = createServiceClient()
  
  const { error } = await supabaseService
    .from('youtube_channels')
    .upsert({
      user_id: userId,
      channel_id: channelData.channelId,
      title: channelData.title,
      description: channelData.description,
      custom_url: channelData.customUrl,
      thumbnail_url: channelData.thumbnailUrl,
      subscriber_count: channelData.subscriberCount,
      video_count: channelData.videoCount,
      view_count: channelData.viewCount,
      published_at: channelData.publishedAt,
      country: channelData.country,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    })
  
  if (error) {
    logError(error, {
      service: 'youtube',
      operation: 'storeChannelData',
      userId,
    })
    return { success: false, error: error.message }
  }
  
  return { success: true, error: null }
}

/**
 * Video list item for "my channel" videos (uploads playlist).
 */
export interface MyChannelVideoItem {
  videoId: string
  title: string
  publishedAt: string
  thumbnailUrl: string
  viewCount?: number
  likeCount?: number
}

/**
 * Fetch videos from the authenticated user's channel (uploads playlist).
 * Uses OAuth; cap maxResults at 50 for agent use.
 */
export async function fetchMyChannelVideos(
  userId: string,
  maxResults: number = 10,
  pageToken?: string
): Promise<{
  videos: MyChannelVideoItem[]
  nextPageToken: string | null
  error: string | null
}> {
  const accessToken = await ensureValidToken(userId)
  if (!accessToken) {
    return { videos: [], nextPageToken: null, error: 'Unable to get valid access token' }
  }

  try {
    const urlChannels = new URL(`${YOUTUBE_DATA_API_BASE}/channels`)
    urlChannels.searchParams.set('part', 'contentDetails')
    urlChannels.searchParams.set('mine', 'true')
    const resChannels = await fetch(urlChannels.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!resChannels.ok) {
      const err = await resChannels.json()
      logError(new Error('YouTube API channels error'), {
        service: 'youtube',
        operation: 'fetchMyChannelVideos',
        userId,
        status: resChannels.status,
        error: (err as { error?: { message?: string } })?.error?.message,
      })
      return {
        videos: [],
        nextPageToken: null,
        error: (err as { error?: { message?: string } })?.error?.message || 'Failed to get channel',
      }
    }
    const dataChannels = (await resChannels.json()) as {
      items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>
    }
    const uploadsPlaylistId = dataChannels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) {
      return { videos: [], nextPageToken: null, error: 'No uploads playlist found' }
    }

    const urlPlaylist = new URL(`${YOUTUBE_DATA_API_BASE}/playlistItems`)
    urlPlaylist.searchParams.set('part', 'snippet,contentDetails')
    urlPlaylist.searchParams.set('playlistId', uploadsPlaylistId)
    urlPlaylist.searchParams.set('maxResults', String(Math.min(Math.max(1, maxResults), 50)))
    if (pageToken) urlPlaylist.searchParams.set('pageToken', pageToken)
    const resPlaylist = await fetch(urlPlaylist.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!resPlaylist.ok) {
      const err = await resPlaylist.json()
      logError(new Error('YouTube API playlistItems error'), {
        service: 'youtube',
        operation: 'fetchMyChannelVideos',
        userId,
        status: resPlaylist.status,
        error: (err as { error?: { message?: string } })?.error?.message,
      })
      return {
        videos: [],
        nextPageToken: null,
        error: (err as { error?: { message?: string } })?.error?.message || 'Failed to get playlist',
      }
    }

    const dataPlaylist = (await resPlaylist.json()) as {
      items?: Array<{
        contentDetails?: { videoId?: string }
        snippet?: {
          title?: string
          publishedAt?: string
          thumbnails?: Record<string, { url?: string }>
        }
      }>
      nextPageToken?: string
    }

    const videos: MyChannelVideoItem[] = []
    for (const item of dataPlaylist.items ?? []) {
      const videoId = item.contentDetails?.videoId
      if (!videoId) continue
      const snippet = item.snippet ?? {}
      const thumbnails = snippet.thumbnails ?? {}
      videos.push({
        videoId,
        title: snippet.title ?? 'Untitled',
        publishedAt: snippet.publishedAt ?? '',
        thumbnailUrl: thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? '',
      })
    }

    if (videos.length > 0) {
      const ids = videos.map((v) => v.videoId).join(',')
      const urlStats = new URL(`${YOUTUBE_DATA_API_BASE}/videos`)
      urlStats.searchParams.set('part', 'statistics')
      urlStats.searchParams.set('id', ids)
      const resStats = await fetch(urlStats.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (resStats.ok) {
        const dataStats = (await resStats.json()) as {
          items?: Array<{ id?: string; statistics?: { viewCount?: string; likeCount?: string } }>
        }
        const byId = new Map(
          (dataStats.items ?? []).map((i) => [
            i.id,
            {
              viewCount: i.statistics?.viewCount != null ? parseInt(i.statistics.viewCount, 10) : undefined,
              likeCount: i.statistics?.likeCount != null ? parseInt(i.statistics.likeCount, 10) : undefined,
            },
          ])
        )
        for (const v of videos) {
          const s = byId.get(v.videoId)
          if (s) {
            v.viewCount = s.viewCount
            v.likeCount = s.likeCount
          }
        }
      }
    }

    return {
      videos,
      nextPageToken: dataPlaylist.nextPageToken ?? null,
      error: null,
    }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchMyChannelVideos',
      userId,
    })
    return {
      videos: [],
      nextPageToken: null,
      error: error instanceof Error ? error.message : 'Failed to fetch channel videos',
    }
  }
}

// ============================================================================
// YouTube Analytics API
// ============================================================================

/**
 * Fetch YouTube Analytics for the authenticated user's channel
 * 
 * @param userId - User ID
 * @param startDate - Start date (YYYY-MM-DD format)
 * @param endDate - End date (YYYY-MM-DD format)
 */
export async function fetchYouTubeAnalytics(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ data: YouTubeAnalyticsData | null; error: string | null }> {
  const accessToken = await ensureValidToken(userId)
  
  if (!accessToken) {
    return { data: null, error: 'Unable to get valid access token' }
  }
  
  try {
    const url = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`)
    url.searchParams.set('ids', 'channel==MINE')
    url.searchParams.set('startDate', startDate)
    url.searchParams.set('endDate', endDate)
    url.searchParams.set('metrics', [
      'views',
      'estimatedMinutesWatched',
      'averageViewDuration',
      'subscribersGained',
      'subscribersLost',
      'likes',
      'dislikes',
      'comments',
      'shares',
    ].join(','))
    
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      logError(new Error('YouTube Analytics API error'), {
        service: 'youtube',
        operation: 'fetchYouTubeAnalytics',
        userId,
        status: response.status,
        error: errorData.error?.message,
      })
      return { data: null, error: errorData.error?.message || 'YouTube Analytics API error' }
    }
    
    const data = await response.json()
    
    // YouTube Analytics returns data in rows array
    // First row contains the aggregated data
    const row = data.rows?.[0] || []
    const headers = data.columnHeaders?.map((h: { name: string }) => h.name) || []
    
    // Map headers to values
    const getValue = (name: string): number => {
      const index = headers.indexOf(name)
      return index >= 0 ? (row[index] || 0) : 0
    }
    
    const analyticsData: YouTubeAnalyticsData = {
      views: getValue('views'),
      watchTimeMinutes: getValue('estimatedMinutesWatched'),
      averageViewDurationSeconds: getValue('averageViewDuration'),
      subscribersGained: getValue('subscribersGained'),
      subscribersLost: getValue('subscribersLost'),
      likes: getValue('likes'),
      dislikes: getValue('dislikes'),
      comments: getValue('comments'),
      shares: getValue('shares'),
      estimatedRevenue: null, // Revenue requires additional scope
    }
    
    return { data: analyticsData, error: null }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchYouTubeAnalytics',
      userId,
    })
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Failed to fetch analytics' 
    }
  }
}

/**
 * Store analytics data in the database
 */
export async function storeAnalyticsData(
  userId: string,
  channelId: string,
  startDate: string,
  endDate: string,
  analyticsData: YouTubeAnalyticsData
): Promise<{ success: boolean; error: string | null }> {
  const supabaseService = createServiceClient()
  
  const { error } = await supabaseService
    .from('youtube_analytics')
    .upsert({
      user_id: userId,
      channel_id: channelId,
      date_range_start: startDate,
      date_range_end: endDate,
      views: analyticsData.views,
      watch_time_minutes: analyticsData.watchTimeMinutes,
      average_view_duration_seconds: analyticsData.averageViewDurationSeconds,
      subscribers_gained: analyticsData.subscribersGained,
      subscribers_lost: analyticsData.subscribersLost,
      likes: analyticsData.likes,
      dislikes: analyticsData.dislikes,
      comments: analyticsData.comments,
      shares: analyticsData.shares,
      estimated_revenue: analyticsData.estimatedRevenue,
      fetched_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,date_range_start,date_range_end',
    })
  
  if (error) {
    logError(error, {
      service: 'youtube',
      operation: 'storeAnalyticsData',
      userId,
    })
    return { success: false, error: error.message }
  }
  
  return { success: true, error: null }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format date as YYYY-MM-DD for YouTube Analytics API
 */
export function formatDateForAnalytics(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Get date range for last N days
 */
export function getDateRangeForLastNDays(days: number): { startDate: string; endDate: string } {
  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 1) // Yesterday (analytics may not have today's data)
  
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - days + 1)
  
  return {
    startDate: formatDateForAnalytics(startDate),
    endDate: formatDateForAnalytics(endDate),
  }
}

/**
 * Check if a user has a connected YouTube integration
 */
export async function isYouTubeConnected(userId: string): Promise<boolean> {
  const integration = await getYouTubeIntegration(userId)
  return integration !== null
}

// ============================================================================
// Per-Video Analytics API
// ============================================================================

/**
 * Video details from YouTube Data API v3
 */
export interface VideoDetails {
  videoId: string
  title: string
  description: string
  thumbnailUrl: string
  publishedAt: string
  viewCount: number
  likeCount: number
  commentCount: number
}

/**
 * Fetch video details from YouTube Data API v3
 */
export async function fetchVideoDetailsFromDataAPI(
  videoId: string,
  accessToken: string
): Promise<VideoDetails | null> {
  try {
    const url = new URL(`${YOUTUBE_DATA_API_BASE}/videos`)
    url.searchParams.set('part', 'snippet,statistics')
    url.searchParams.set('id', videoId)
    
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      logError(new Error('YouTube Data API error'), {
        service: 'youtube',
        operation: 'fetchVideoDetailsFromDataAPI',
        videoId,
        status: response.status,
        error: errorData.error?.message,
      })
      return null
    }
    
    const data = await response.json()
    
    if (!data.items || data.items.length === 0) {
      return null
    }
    
    const item = data.items[0]
    const snippet = item.snippet || {}
    const statistics = item.statistics || {}
    const thumbnails = snippet.thumbnails || {}
    
    // Pick best available thumbnail: high > medium > default
    const thumbnailUrl = thumbnails.high?.url || 
                        thumbnails.medium?.url || 
                        thumbnails.default?.url || 
                        ''
    
    return {
      videoId,
      title: snippet.title || 'Untitled',
      description: snippet.description || '',
      thumbnailUrl,
      publishedAt: snippet.publishedAt || '',
      viewCount: parseInt(statistics.viewCount || '0', 10),
      likeCount: parseInt(statistics.likeCount || '0', 10),
      commentCount: parseInt(statistics.commentCount || '0', 10),
    }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchVideoDetailsFromDataAPI',
      videoId,
    })
    return null
  }
}

/**
 * Per-video analytics aggregate metrics
 */
export interface PerVideoAnalytics {
  views: number
  watchTimeMinutes: number
  averageViewDurationSeconds: number
}

/**
 * Fetch per-video analytics aggregate metrics
 */
export async function fetchPerVideoAnalytics(
  videoId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<PerVideoAnalytics | null> {
  try {
    const url = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`)
    url.searchParams.set('ids', `video==${videoId}`)
    url.searchParams.set('startDate', startDate)
    url.searchParams.set('endDate', endDate)
    url.searchParams.set('metrics', 'views,estimatedMinutesWatched,averageViewDuration')
    
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      // Some videos may not have analytics data yet (too new)
      if (response.status === 400 || response.status === 403) {
        logWarn('Video analytics not available', {
          service: 'youtube',
          operation: 'fetchPerVideoAnalytics',
          videoId,
          status: response.status,
          error: errorData.error?.message,
        })
        return null
      }
      logError(new Error('YouTube Analytics API error'), {
        service: 'youtube',
        operation: 'fetchPerVideoAnalytics',
        videoId,
        status: response.status,
        error: errorData.error?.message,
      })
      return null
    }
    
    const data = await response.json()
    
    // YouTube Analytics returns data in rows array
    const row = data.rows?.[0] || []
    const headers = data.columnHeaders?.map((h: { name: string }) => h.name) || []
    
    // Map headers to values
    const getValue = (name: string): number => {
      const index = headers.indexOf(name)
      return index >= 0 ? (row[index] || 0) : 0
    }
    
    return {
      views: getValue('views'),
      watchTimeMinutes: getValue('estimatedMinutesWatched'),
      averageViewDurationSeconds: getValue('averageViewDuration'),
    }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchPerVideoAnalytics',
      videoId,
    })
    return null
  }
}

/**
 * Time series data point
 */
export interface VideoAnalyticsTimeSeries {
  date: string // YYYY-MM-DD
  views: number
}

/**
 * Fetch per-video analytics time series (daily views)
 */
export async function fetchVideoAnalyticsTimeSeries(
  videoId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<VideoAnalyticsTimeSeries[] | null> {
  try {
    const url = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`)
    url.searchParams.set('ids', `video==${videoId}`)
    url.searchParams.set('startDate', startDate)
    url.searchParams.set('endDate', endDate)
    url.searchParams.set('metrics', 'views')
    url.searchParams.set('dimensions', 'day')
    
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      // Some videos may not have analytics data yet
      if (response.status === 400 || response.status === 403) {
        logWarn('Video time series not available', {
          service: 'youtube',
          operation: 'fetchVideoAnalyticsTimeSeries',
          videoId,
          status: response.status,
          error: errorData.error?.message,
        })
        return null
      }
      logError(new Error('YouTube Analytics API error'), {
        service: 'youtube',
        operation: 'fetchVideoAnalyticsTimeSeries',
        videoId,
        status: response.status,
        error: errorData.error?.message,
      })
      return null
    }
    
    const data = await response.json()
    
    if (!data.rows || data.rows.length === 0) {
      return []
    }
    
    const headers = data.columnHeaders?.map((h: { name: string }) => h.name) || []
    const dateIndex = headers.indexOf('day')
    const viewsIndex = headers.indexOf('views')
    
    return data.rows.map((row: unknown[]) => ({
      date: (row[dateIndex] as string) || '',
      views: (row[viewsIndex] as number) || 0,
    }))
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchVideoAnalyticsTimeSeries',
      videoId,
    })
    return null
  }
}

/**
 * Traffic source data
 */
export interface VideoTrafficSource {
  sourceType: string
  views: number
}

/**
 * Fetch per-video traffic sources
 */
export async function fetchVideoTrafficSources(
  videoId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<VideoTrafficSource[] | null> {
  try {
    const url = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`)
    url.searchParams.set('ids', `video==${videoId}`)
    url.searchParams.set('startDate', startDate)
    url.searchParams.set('endDate', endDate)
    url.searchParams.set('metrics', 'views')
    url.searchParams.set('dimensions', 'insightTrafficSourceType')
    
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      // Some videos may not have analytics data yet
      if (response.status === 400 || response.status === 403) {
        logWarn('Video traffic sources not available', {
          service: 'youtube',
          operation: 'fetchVideoTrafficSources',
          videoId,
          status: response.status,
          error: errorData.error?.message,
        })
        return null
      }
      logError(new Error('YouTube Analytics API error'), {
        service: 'youtube',
        operation: 'fetchVideoTrafficSources',
        videoId,
        status: response.status,
        error: errorData.error?.message,
      })
      return null
    }
    
    const data = await response.json()
    
    if (!data.rows || data.rows.length === 0) {
      return []
    }
    
    const headers = data.columnHeaders?.map((h: { name: string }) => h.name) || []
    const sourceTypeIndex = headers.indexOf('insightTrafficSourceType')
    const viewsIndex = headers.indexOf('views')
    
    return data.rows.map((row: unknown[]) => ({
      sourceType: (row[sourceTypeIndex] as string) || '',
      views: (row[viewsIndex] as number) || 0,
    }))
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchVideoTrafficSources',
      videoId,
    })
    return null
  }
}

/**
 * Impressions data
 */
export interface VideoImpressions {
  impressions: number | null
  impressionsClickThroughRate: number | null // percentage (0-100)
}

/**
 * Fetch per-video impressions and CTR
 * Returns null if not available (may require additional permissions or video may be too new)
 */
export async function fetchVideoImpressions(
  videoId: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<VideoImpressions | null> {
  try {
    const url = new URL(`${YOUTUBE_ANALYTICS_API_BASE}/reports`)
    url.searchParams.set('ids', `video==${videoId}`)
    url.searchParams.set('startDate', startDate)
    url.searchParams.set('endDate', endDate)
    url.searchParams.set('metrics', 'impressions,impressionsClickThroughRate')
    
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      // Impressions may not be available for all videos
      // This is expected and not an error condition
      logWarn('Video impressions not available', {
        service: 'youtube',
        operation: 'fetchVideoImpressions',
        videoId,
        status: response.status,
        error: errorData.error?.message,
      })
      return { impressions: null, impressionsClickThroughRate: null }
    }
    
    const data = await response.json()
    
    if (!data.rows || data.rows.length === 0) {
      return { impressions: null, impressionsClickThroughRate: null }
    }
    
    const row = data.rows[0] || []
    const headers = data.columnHeaders?.map((h: { name: string }) => h.name) || []
    
    const getValue = (name: string): number | null => {
      const index = headers.indexOf(name)
      if (index < 0) return null
      const value = row[index]
      return value !== null && value !== undefined ? value : null
    }
    
    return {
      impressions: getValue('impressions'),
      impressionsClickThroughRate: getValue('impressionsClickThroughRate'),
    }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchVideoImpressions',
      videoId,
    })
    // Return null values rather than failing
    return { impressions: null, impressionsClickThroughRate: null }
  }
}

// ============================================================================
// Search API (uses API key; public data)
// ============================================================================

export interface SearchVideoItem {
  videoId: string
  title: string
  thumbnailUrl: string
  publishedAt: string
  channelId: string
  channelTitle: string
  viewCount?: number
  likeCount?: number
}

/**
 * Search YouTube videos by query using Data API search.list.
 * Uses YOUTUBE_DATA_API_KEY (server-side). Max 50 results per request.
 */
export async function searchVideos(
  query: string,
  maxResults: number = 10,
  order: 'relevance' | 'date' | 'viewCount' | 'rating' = 'relevance'
): Promise<{ items: SearchVideoItem[]; nextPageToken: string | null; error: string | null }> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY
  if (!apiKey) {
    return { items: [], nextPageToken: null, error: 'YOUTUBE_DATA_API_KEY not configured' }
  }

  try {
    const url = new URL(`${YOUTUBE_DATA_API_BASE}/search`)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'video')
    url.searchParams.set('q', query)
    url.searchParams.set('maxResults', String(Math.min(Math.max(1, maxResults), 50)))
    url.searchParams.set('order', order)
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString())
    if (!response.ok) {
      const errorData = await response.json()
      logError(new Error('YouTube search API error'), {
        service: 'youtube',
        operation: 'searchVideos',
        status: response.status,
        error: (errorData as { error?: { message?: string } })?.error?.message,
      })
      return {
        items: [],
        nextPageToken: null,
        error: (errorData as { error?: { message?: string } })?.error?.message || 'Search failed',
      }
    }

    const data = (await response.json()) as {
      items?: Array<{
        id?: { videoId?: string }
        snippet?: {
          title?: string
          publishedAt?: string
          channelId?: string
          channelTitle?: string
          thumbnails?: Record<string, { url?: string }>
        }
      }>
      nextPageToken?: string
    }

    const items: SearchVideoItem[] = []
    for (const item of data.items ?? []) {
      const videoId = item.id?.videoId
      if (!videoId) continue
      const snippet = item.snippet ?? {}
      const thumbnails = snippet.thumbnails ?? {}
      items.push({
        videoId,
        title: snippet.title ?? 'Untitled',
        thumbnailUrl: thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? '',
        publishedAt: snippet.publishedAt ?? '',
        channelId: snippet.channelId ?? '',
        channelTitle: snippet.channelTitle ?? '',
      })
    }

    return {
      items,
      nextPageToken: data.nextPageToken ?? null,
      error: null,
    }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'searchVideos',
    })
    return {
      items: [],
      nextPageToken: null,
      error: error instanceof Error ? error.message : 'Search failed',
    }
  }
}

/**
 * Playlist video item (public playlist by ID).
 */
export interface PlaylistVideoItem {
  videoId: string
  title: string
  thumbnailUrl: string
  publishedAt: string
  viewCount?: number
  likeCount?: number
}

/**
 * Fetch videos from a playlist by playlist ID using Data API playlistItems.list.
 * Uses YOUTUBE_DATA_API_KEY (public playlists).
 */
export async function fetchPlaylistVideosByPlaylistId(
  playlistId: string,
  maxResults: number = 20,
  pageToken?: string
): Promise<{ items: PlaylistVideoItem[]; nextPageToken: string | null; error: string | null }> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY
  if (!apiKey) {
    return { items: [], nextPageToken: null, error: 'YOUTUBE_DATA_API_KEY not configured' }
  }

  try {
    const url = new URL(`${YOUTUBE_DATA_API_BASE}/playlistItems`)
    url.searchParams.set('part', 'snippet,contentDetails')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('maxResults', String(Math.min(Math.max(1, maxResults), 50)))
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString())
    if (!response.ok) {
      const errorData = await response.json()
      logError(new Error('YouTube playlistItems API error'), {
        service: 'youtube',
        operation: 'fetchPlaylistVideosByPlaylistId',
        playlistId,
        status: response.status,
        error: (errorData as { error?: { message?: string } })?.error?.message,
      })
      return {
        items: [],
        nextPageToken: null,
        error: (errorData as { error?: { message?: string } })?.error?.message || 'Failed to fetch playlist',
      }
    }

    const data = (await response.json()) as {
      items?: Array<{
        contentDetails?: { videoId?: string }
        snippet?: {
          title?: string
          publishedAt?: string
          thumbnails?: Record<string, { url?: string }>
        }
      }>
      nextPageToken?: string
    }

    const items: PlaylistVideoItem[] = []
    for (const item of data.items ?? []) {
      const videoId = item.contentDetails?.videoId
      if (!videoId) continue
      const snippet = item.snippet ?? {}
      const thumbnails = snippet.thumbnails ?? {}
      items.push({
        videoId,
        title: snippet.title ?? 'Untitled',
        thumbnailUrl: thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? '',
        publishedAt: snippet.publishedAt ?? '',
      })
    }

    return {
      items,
      nextPageToken: data.nextPageToken ?? null,
      error: null,
    }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchPlaylistVideosByPlaylistId',
      playlistId,
    })
    return {
      items: [],
      nextPageToken: null,
      error: error instanceof Error ? error.message : 'Failed to fetch playlist',
    }
  }
}

// ============================================================================
// Comments API (uses OAuth)
// ============================================================================

export interface VideoCommentItem {
  id: string
  text: string
  likeCount: number
  authorDisplayName: string
  publishedAt: string
}

/**
 * Fetch top-level comments for a video using commentThreads.list.
 * Requires OAuth access token with YouTube scope.
 */
export async function fetchVideoComments(
  videoId: string,
  accessToken: string,
  maxResults: number = 20
): Promise<{ items: VideoCommentItem[]; error: string | null }> {
  try {
    const url = new URL(`${YOUTUBE_DATA_API_BASE}/commentThreads`)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('videoId', videoId)
    url.searchParams.set('maxResults', String(Math.min(Math.max(1, maxResults), 100)))
    url.searchParams.set('order', 'relevance')
    url.searchParams.set('textFormat', 'plainText')

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errorData = await response.json()
      logError(new Error('YouTube commentThreads API error'), {
        service: 'youtube',
        operation: 'fetchVideoComments',
        videoId,
        status: response.status,
        error: (errorData as { error?: { message?: string } })?.error?.message,
      })
      return {
        items: [],
        error: (errorData as { error?: { message?: string } })?.error?.message || 'Failed to fetch comments',
      }
    }

    const data = (await response.json()) as {
      items?: Array<{
        id?: string
        snippet?: {
          topLevelComment?: {
            snippet?: {
              textDisplay?: string
              likeCount?: number
              authorDisplayName?: string
              publishedAt?: string
            }
          }
        }
      }>
    }

    const items: VideoCommentItem[] = []
    for (const item of data.items ?? []) {
      const top = item.snippet?.topLevelComment?.snippet
      if (!top) continue
      items.push({
        id: item.id ?? '',
        text: (top.textDisplay ?? '').replace(/<[^>]*>/g, '').trim(),
        likeCount: top.likeCount ?? 0,
        authorDisplayName: top.authorDisplayName ?? '',
        publishedAt: top.publishedAt ?? '',
      })
    }

    return { items, error: null }
  } catch (error) {
    logError(error, {
      service: 'youtube',
      operation: 'fetchVideoComments',
      videoId,
    })
    return {
      items: [],
      error: error instanceof Error ? error.message : 'Failed to fetch comments',
    }
  }
}
