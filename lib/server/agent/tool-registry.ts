/**
 * Agent tool registry: tool name → { schema, handler }.
 * Used by POST /api/agent/execute-tool for allowlist and param validation.
 * All handlers receive authenticated userId; YouTube tools require Pro + connected.
 */

import { z } from 'zod'
import {
  fetchMyChannelVideos,
  fetchVideoDetailsFromDataAPI,
  searchVideos,
  fetchPlaylistVideosByPlaylistId,
  fetchVideoComments,
  fetchYouTubeAnalytics,
  fetchPerVideoAnalytics,
  fetchVideoAnalyticsTimeSeries,
  fetchYouTubeChannel,
  ensureValidToken,
  getDateRangeForLastNDays,
  setVideoThumbnailFromUrl,
} from '@/lib/services/youtube'
import { parseYouTubeVideoId } from '@/lib/utils/youtube'
import { getThumbnailImageUrlForUser } from '@/lib/server/data/thumbnails'

export interface AgentToolContext {
  tier: string
  connected: boolean
}

export type ToolHandler = (
  userId: string,
  params: unknown,
  context?: AgentToolContext
) => Promise<unknown>

export interface ToolEntry {
  schema: z.ZodType
  handler: ToolHandler
  /** If true, requires tier === 'pro' and YouTube connected. */
  requiresYouTube: boolean
}

const listMyVideosSchema = z.object({
  maxResults: z.number().min(1).max(50).optional().default(10),
  pageToken: z.string().optional(),
})

const getVideoDetailsSchema = z.object({
  video_id: z.string().min(1),
})

const searchVideosSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().min(1).max(50).optional().default(10),
  order: z.enum(['relevance', 'date', 'viewCount', 'rating']).optional().default('relevance'),
})

const getPlaylistVideosSchema = z.object({
  playlist_id: z.string().min(1),
  maxResults: z.number().min(1).max(50).optional().default(20),
  pageToken: z.string().optional(),
})

const getVideoCommentsSchema = z.object({
  video_id: z.string().min(1),
  maxResults: z.number().min(1).max(100).optional().default(20),
})

const getChannelAnalyticsSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.number().min(1).max(365).optional().default(28),
})

const getVideoAnalyticsSchema = z.object({
  video_id: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.number().min(1).max(365).optional().default(28),
})

const checkYoutubeConnectionSchema = z.object({})

const getChannelPulseSchema = z.object({
  days: z.number().min(1).max(14).optional().default(7),
  recentVideosCount: z.number().min(1).max(10).optional().default(5),
})

const getUnderperformingVideosSchema = z.object({
  days: z.number().min(1).max(90).optional().default(28),
  maxVideosToCheck: z.number().min(1).max(20).optional().default(10),
})

const applyThumbnailToVideoSchema = z.object({
  video_id: z.string().min(1),
  thumbnail_id: z.string().min(1),
})

const getUploadRhythmSchema = z.object({
  lastN: z.number().min(1).max(50).optional().default(20),
})

export const AGENT_TOOL_REGISTRY: Record<string, ToolEntry> = {
  check_youtube_connection: {
    schema: checkYoutubeConnectionSchema,
    requiresYouTube: false,
    handler: async (_userId, _params, context) => {
      if (!context) return { connected: false, tier: 'free' }
      return { connected: context.connected, tier: context.tier }
    },
  },

  list_my_videos: {
    schema: listMyVideosSchema,
    requiresYouTube: true,
    handler: async (userId, params) => {
      const { maxResults, pageToken } = params as z.infer<typeof listMyVideosSchema>
      const result = await fetchMyChannelVideos(userId, maxResults, pageToken)
      if (result.error) throw new Error(result.error)
      return { videos: result.videos, nextPageToken: result.nextPageToken }
    },
  },

  get_video_details: {
    schema: getVideoDetailsSchema,
    requiresYouTube: true,
    handler: async (userId, params) => {
      const { video_id } = params as z.infer<typeof getVideoDetailsSchema>
      const videoId = parseYouTubeVideoId(video_id) ?? video_id
      const token = await ensureValidToken(userId)
      if (!token) throw new Error('Unable to get valid access token')
      const details = await fetchVideoDetailsFromDataAPI(videoId, token)
      if (!details) return { error: 'Video not found or not accessible' }
      return details
    },
  },

  search_videos: {
    schema: searchVideosSchema,
    requiresYouTube: false,
    handler: async (_userId, params) => {
      const { query, maxResults, order } = params as z.infer<typeof searchVideosSchema>
      const result = await searchVideos(query, maxResults, order)
      if (result.error) throw new Error(result.error)
      return { items: result.items, nextPageToken: result.nextPageToken }
    },
  },

  get_playlist_videos: {
    schema: getPlaylistVideosSchema,
    requiresYouTube: false,
    handler: async (_userId, params) => {
      const { playlist_id, maxResults, pageToken } = params as z.infer<typeof getPlaylistVideosSchema>
      const result = await fetchPlaylistVideosByPlaylistId(playlist_id, maxResults, pageToken)
      if (result.error) throw new Error(result.error)
      return { items: result.items, nextPageToken: result.nextPageToken }
    },
  },

  get_video_comments: {
    schema: getVideoCommentsSchema,
    requiresYouTube: true,
    handler: async (userId, params) => {
      const { video_id, maxResults } = params as z.infer<typeof getVideoCommentsSchema>
      const videoId = parseYouTubeVideoId(video_id) ?? video_id
      const token = await ensureValidToken(userId)
      if (!token) throw new Error('Unable to get valid access token')
      const result = await fetchVideoComments(videoId, token, maxResults)
      if (result.error) throw new Error(result.error)
      return { items: result.items }
    },
  },

  get_channel_analytics: {
    schema: getChannelAnalyticsSchema,
    requiresYouTube: true,
    handler: async (userId, params) => {
      const parsed = params as z.infer<typeof getChannelAnalyticsSchema>
      let startDate: string
      let endDate: string
      if (parsed.start_date && parsed.end_date) {
        startDate = parsed.start_date
        endDate = parsed.end_date
      } else {
        const range = getDateRangeForLastNDays(parsed.days ?? 28)
        startDate = range.startDate
        endDate = range.endDate
      }
      const result = await fetchYouTubeAnalytics(userId, startDate, endDate)
      if (result.error) throw new Error(result.error)
      return { ...result.data, startDate, endDate }
    },
  },

  get_video_analytics: {
    schema: getVideoAnalyticsSchema,
    requiresYouTube: true,
    handler: async (userId, params) => {
      const parsed = params as z.infer<typeof getVideoAnalyticsSchema>
      const videoId = parseYouTubeVideoId(parsed.video_id) ?? parsed.video_id
      let startDate: string
      let endDate: string
      if (parsed.start_date && parsed.end_date) {
        startDate = parsed.start_date
        endDate = parsed.end_date
      } else {
        const range = getDateRangeForLastNDays(parsed.days ?? 28)
        startDate = range.startDate
        endDate = range.endDate
      }
      const token = await ensureValidToken(userId)
      if (!token) throw new Error('Unable to get valid access token')
      const aggregate = await fetchPerVideoAnalytics(videoId, token, startDate, endDate)
      if (!aggregate) {
        return {
          videoId,
          message: 'Analytics not available for this video (e.g. too new or no data in range).',
          startDate,
          endDate,
        }
      }
      const timeSeries = await fetchVideoAnalyticsTimeSeries(videoId, token, startDate, endDate)
      return {
        videoId,
        ...aggregate,
        timeSeries: timeSeries ?? [],
        startDate,
        endDate,
      }
    },
  },

  get_my_channel_info: {
    schema: z.object({}),
    requiresYouTube: true,
    handler: async (userId) => {
      const result = await fetchYouTubeChannel(userId)
      if (result.error) throw new Error(result.error)
      return result.data
    },
  },

  // --- Sub-agent: Channel pulse (runs channel info + analytics + recent videos in parallel)
  get_channel_pulse: {
    schema: getChannelPulseSchema,
    requiresYouTube: true,
    handler: async (userId, params) => {
      const { days, recentVideosCount } = params as z.infer<typeof getChannelPulseSchema>
      const range = getDateRangeForLastNDays(days)
      const [channelResult, analyticsResult, videosResult] = await Promise.all([
        fetchYouTubeChannel(userId),
        fetchYouTubeAnalytics(userId, range.startDate, range.endDate),
        fetchMyChannelVideos(userId, recentVideosCount),
      ])
      return {
        channel: channelResult.error ? null : channelResult.data,
        analytics: analyticsResult.error ? null : { ...analyticsResult.data, startDate: range.startDate, endDate: range.endDate },
        recentVideos: videosResult.error ? [] : videosResult.videos,
        errors: [channelResult.error, analyticsResult.error, videosResult.error].filter(Boolean),
      }
    },
  },

  // --- Sub-agent: Underperforming videos (below average views in period)
  get_underperforming_videos: {
    schema: getUnderperformingVideosSchema,
    requiresYouTube: true,
    handler: async (userId, params) => {
      const { days, maxVideosToCheck } = params as z.infer<typeof getUnderperformingVideosSchema>
      const range = getDateRangeForLastNDays(days)
      const videosResult = await fetchMyChannelVideos(userId, maxVideosToCheck)
      if (videosResult.error || !videosResult.videos.length) {
        return { videos: [], averageViews: 0, startDate: range.startDate, endDate: range.endDate }
      }
      const token = await ensureValidToken(userId)
      if (!token) throw new Error('Unable to get valid access token')
      const withViews: Array<{ videoId: string; title: string; thumbnailUrl: string; views: number }> = []
      for (const v of videosResult.videos) {
        const agg = await fetchPerVideoAnalytics(v.videoId, token, range.startDate, range.endDate)
        withViews.push({
          videoId: v.videoId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          views: agg?.views ?? 0,
        })
      }
      const totalViews = withViews.reduce((s, x) => s + x.views, 0)
      const averageViews = withViews.length ? totalViews / withViews.length : 0
      const underperforming = averageViews > 0
        ? withViews.filter((x) => x.views < averageViews).sort((a, b) => a.views - b.views)
        : []
      return {
        videos: underperforming,
        averageViews: Math.round(averageViews),
        startDate: range.startDate,
        endDate: range.endDate,
      }
    },
  },

  // --- Sub-agent: Apply thumbnail to YouTube video
  apply_thumbnail_to_video: {
    schema: applyThumbnailToVideoSchema,
    requiresYouTube: true,
    handler: async (userId, params) => {
      const { video_id, thumbnail_id } = params as z.infer<typeof applyThumbnailToVideoSchema>
      const videoId = parseYouTubeVideoId(video_id) ?? video_id
      const { imageUrl, error: urlError } = await getThumbnailImageUrlForUser(userId, thumbnail_id)
      if (urlError || !imageUrl) throw new Error(urlError ?? 'Thumbnail not found or access denied')
      const result = await setVideoThumbnailFromUrl(userId, videoId, imageUrl)
      if (!result.success) throw new Error(result.error ?? 'Failed to set thumbnail')
      return { success: true, videoId, message: 'Thumbnail applied successfully' }
    },
  },

  // --- Sub-agent: Upload rhythm (recent upload dates + summary)
  get_upload_rhythm: {
    schema: getUploadRhythmSchema,
    requiresYouTube: true,
    handler: async (userId, params) => {
      const { lastN } = params as z.infer<typeof getUploadRhythmSchema>
      const result = await fetchMyChannelVideos(userId, lastN)
      if (result.error) return { uploadDates: [], summary: result.error }
      const uploadDates = result.videos.map((v) => ({ videoId: v.videoId, title: v.title, publishedAt: v.publishedAt }))
      const dayNames = uploadDates.map((d) => {
        const date = new Date(d.publishedAt)
        return date.toLocaleDateString('en-US', { weekday: 'short' })
      })
      const countByDay = dayNames.reduce<Record<string, number>>((acc, day) => {
        acc[day] = (acc[day] ?? 0) + 1
        return acc
      }, {})
      const topDays = Object.entries(countByDay)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([day, count]) => `${day} (${count})`)
      return {
        uploadDates,
        totalInPeriod: uploadDates.length,
        summary: topDays.length
          ? `Last ${uploadDates.length} uploads; most often on: ${topDays.join(', ')}`
          : 'No recent uploads in this range.',
      }
    },
  },
}

/** Tool names that are allowed to be called by the agent. */
export const AGENT_TOOL_NAMES = Object.keys(AGENT_TOOL_REGISTRY) as string[]
