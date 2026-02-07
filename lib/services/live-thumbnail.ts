/**
 * Live Thumbnail Service
 *
 * Tracks when a ViewBait thumbnail is promoted to a YouTube video (live period).
 * recordPromotion ends any current live period for (user, video) and inserts a new one.
 * Metrics (views, watch time, impressions, CTR) are fetched for ended periods.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ThumbnailLivePeriod } from '@/lib/types/database'
import {
  ensureValidToken,
  fetchPerVideoAnalytics,
  fetchVideoImpressions,
  fetchVideoThumbnailImpressions,
  formatDateForAnalytics,
} from '@/lib/services/youtube'
import { logError, logWarn } from '@/lib/server/utils/logger'

const TABLE = 'thumbnail_live_periods'

/**
 * End any current live period for (userId, videoId) and insert a new period.
 * Only call when set-thumbnail succeeded with thumbnail_id.
 * If a period was ended, fetches and stores its metrics in the background (fire-and-forget).
 *
 * @param supabase - User-scoped client (from createClient()) so RLS allows insert/update
 */
export async function recordPromotion(
  supabase: SupabaseClient,
  userId: string,
  thumbnailId: string,
  videoId: string,
  videoTitle?: string | null
): Promise<void> {
  const now = new Date().toISOString()

  // End existing active period for this (user, video)
  const { data: endedRows, error: updateError } = await supabase
    .from(TABLE)
    .update({ ended_at: now, updated_at: now })
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .is('ended_at', null)
    .select('id')

  if (updateError) {
    logError(updateError as Error, {
      service: 'live-thumbnail',
      operation: 'recordPromotion.update',
      userId,
      videoId,
    })
    throw updateError
  }

  const endedPeriodId = endedRows?.[0]?.id ?? null

  // Insert new period
  const { error: insertError } = await supabase.from(TABLE).insert({
    user_id: userId,
    thumbnail_id: thumbnailId,
    video_id: videoId,
    started_at: now,
    ended_at: null,
    video_title: videoTitle ?? null,
  })

  if (insertError) {
    logError(insertError as Error, {
      service: 'live-thumbnail',
      operation: 'recordPromotion.insert',
      userId,
      videoId,
      thumbnailId,
    })
    throw insertError
  }

  // Fire-and-forget: fetch and store metrics for the ended period so API responds fast
  if (endedPeriodId) {
    fetchAndStoreMetricsForPeriod(supabase, endedPeriodId).catch((err) => {
      logWarn('Background metrics fetch failed for ended period', {
        service: 'live-thumbnail',
        periodId: endedPeriodId,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }
}

/**
 * Load period by id (RLS applies), fetch YouTube Analytics for the period's date range,
 * then update the row with views, watch_time_minutes, average_view_duration_seconds,
 * impressions, impressions_ctr_percent, metrics_fetched_at.
 * Uses yesterday as end date when period is still open (ended_at null) to avoid lag.
 */
export async function fetchAndStoreMetricsForPeriod(
  supabase: SupabaseClient,
  periodId: string
): Promise<void> {
  const { data: period, error: selectError } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', periodId)
    .single()

  if (selectError || !period) {
    logWarn('Period not found for metrics fetch', {
      service: 'live-thumbnail',
      periodId,
      error: selectError?.message,
    })
    return
  }

  const row = period as ThumbnailLivePeriod
  const startDate = new Date(row.started_at)
  const endDate = row.ended_at ? new Date(row.ended_at) : new Date()
  if (!row.ended_at) {
    endDate.setDate(endDate.getDate() - 1) // yesterday when still live
  }
  const startStr = formatDateForAnalytics(startDate)
  const endStr = formatDateForAnalytics(endDate)

  const accessToken = await ensureValidToken(row.user_id)
  if (!accessToken) {
    logWarn('No valid YouTube token for metrics fetch', {
      service: 'live-thumbnail',
      periodId,
      userId: row.user_id,
    })
    return
  }

  const [analytics, impressions, thumbnailImpressions] = await Promise.all([
    fetchPerVideoAnalytics(row.video_id, accessToken, startStr, endStr),
    fetchVideoImpressions(row.video_id, accessToken, startStr, endStr),
    fetchVideoThumbnailImpressions(row.video_id, accessToken, startStr, endStr),
  ])

  const updates: Partial<ThumbnailLivePeriod> = {
    metrics_fetched_at: new Date().toISOString(),
  }
  if (analytics) {
    updates.views = analytics.views
    updates.watch_time_minutes = analytics.watchTimeMinutes
    updates.average_view_duration_seconds = analytics.averageViewDurationSeconds
  }
  if (impressions?.impressions != null) {
    updates.impressions = impressions.impressions
  }
  if (impressions?.impressionsClickThroughRate != null) {
    updates.impressions_ctr_percent = impressions.impressionsClickThroughRate
  }
  if (thumbnailImpressions.thumbnailImpressions != null) {
    updates.thumbnail_impressions = thumbnailImpressions.thumbnailImpressions
  }
  if (thumbnailImpressions.thumbnailClickThroughRate != null) {
    // API may return 0-100 or 0-1; normalize to 0-100 for DB
    const rate = thumbnailImpressions.thumbnailClickThroughRate
    updates.thumbnail_ctr_percent = rate <= 1 ? rate * 100 : rate
  }

  const { error: updateError } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', periodId)

  if (updateError) {
    logError(updateError as Error, {
      service: 'live-thumbnail',
      operation: 'fetchAndStoreMetricsForPeriod.update',
      periodId,
    })
  }
}
