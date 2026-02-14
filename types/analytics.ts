/**
 * Analytics event types for custom user analytics.
 * Used by POST /api/track and GET /api/admin/analytics/events.
 */

/** Single event payload from client (server overwrites user_id). */
export interface TrackEventPayload {
  event_name: string
  session_id?: string
  page_path?: string
  properties?: Record<string, unknown>
}

/** Batch body for POST /api/track. */
export interface TrackBatchBody {
  events: TrackEventPayload[]
}

/** Row shape from analytics_events table (for export and admin). */
export interface AnalyticsEventRow {
  id: string
  event_name: string
  user_id: string | null
  session_id: string
  page_path: string | null
  properties: Record<string, unknown>
  created_at: string
}

/** Export format for account export (no session_id). */
export interface AnalyticsEventExportItem {
  event_name: string
  created_at: string
  page_path: string | null
  properties: Record<string, unknown>
}

/** Admin events API overview response. */
export interface AdminEventsAnalyticsResponse {
  allEvents: Array<{ event_name: string; count: number }>
  activeUsers: {
    daily: number
    weekly: number
    monthly: number
  }
  errors: {
    /** Total number of error events in the range (use for display). */
    totalInRange: number
    recent: Array<{ id: string; created_at: string; properties: Record<string, unknown> }>
  }
  /** Top page paths by page_view count (path may be page_path or properties.path). */
  topPaths?: Array<{ path: string; count: number }>
  featureAdoption?: {
    generateStarted: number
    generateCompleted: number
    dropOffRate: number
    checkoutStarted?: number
    checkoutCompleted?: number
    checkoutDropOffRate?: number
    assistantMessagesSent?: number
    assistantResponsesReceived?: number
    youtubeConnectStarted?: number
    youtubeConnectCompleted?: number
    youtubeConnectFailed?: number
  }
  /** Daily buckets for charts (optional, when requested). */
  timeSeries?: Array<AdminEventsTimeSeriesBucket>
}

/** Daily bucket for time-series charts (optional). */
export interface AdminEventsTimeSeriesBucket {
  date: string
  events: number
  pageViews: number
  dau: number
  generateStarted: number
  generateCompleted: number
  errors: number
}

/** Admin events API journeys response (optional view=journeys). */
export interface AdminEventsJourneysResponse {
  sessions: Array<{
    session_id: string
    user_id: string | null
    events: Array<{ event_name: string; created_at: string; page_path: string | null }>
  }>
}
