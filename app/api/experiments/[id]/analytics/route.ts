/**
 * Experiment Analytics API Route
 * 
 * Returns analytics time-series for an experiment's video.
 * Shows data for:
 * - 14 days before started_at
 * - From started_at to completed_at (or today minus data lag)
 * - 14 days after completed_at (when available)
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  databaseErrorResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

export interface AnalyticsSnapshot {
  day: string
  views: number
  estimatedMinutesWatched: number
  averageViewDuration: number
  likes: number
  subscribersGained: number
}

export interface AnalyticsTimeSeries {
  before: AnalyticsSnapshot[]
  during: AnalyticsSnapshot[]
  after: AnalyticsSnapshot[]
  deltas: {
    before: {
      totalViews: number
      totalMinutes: number
      avgMinutesPerView: number
    }
    during: {
      totalViews: number
      totalMinutes: number
      avgMinutesPerView: number
    }
    after: {
      totalViews: number
      totalMinutes: number
      avgMinutesPerView: number
    }
  }
}

/**
 * GET /api/experiments/[id]/analytics
 * Get analytics time-series for an experiment
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Verify experiment exists and belongs to user
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (expError || !experiment) {
      if (expError?.code === 'PGRST116') {
        return notFoundResponse('Experiment not found')
      }
      logError(expError, {
        route: 'GET /api/experiments/[id]/analytics',
        userId: user.id,
        experimentId: id,
        operation: 'fetch-experiment',
      })
      return databaseErrorResponse('Failed to fetch experiment')
    }

    const videoId = experiment.video_id
    const startedAt = experiment.started_at
    const completedAt = experiment.completed_at

    // Calculate date ranges
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Data lag: YouTube Analytics data is typically available up to 2 days ago
    const dataLagDays = 2
    const latestAvailableDate = new Date(today)
    latestAvailableDate.setDate(latestAvailableDate.getDate() - dataLagDays)

    let beforeStart: Date | null = null
    let beforeEnd: Date | null = null
    let duringStart: Date | null = null
    let duringEnd: Date | null = null
    let afterStart: Date | null = null
    let afterEnd: Date | null = null

    if (startedAt) {
      const started = new Date(startedAt)
      started.setHours(0, 0, 0, 0)

      // Before: 14 days before started_at
      beforeStart = new Date(started)
      beforeStart.setDate(beforeStart.getDate() - 14)
      beforeEnd = new Date(started)
      beforeEnd.setDate(beforeEnd.getDate() - 1)

      // During: from started_at to completed_at (or latest available)
      duringStart = started
      duringEnd = completedAt ? new Date(completedAt) : latestAvailableDate
      duringEnd.setHours(23, 59, 59, 999)

      // After: 14 days after completed_at (if completed)
      if (completedAt) {
        const completed = new Date(completedAt)
        completed.setHours(0, 0, 0, 0)
        afterStart = new Date(completed)
        afterStart.setDate(afterStart.getDate() + 1)
        afterEnd = new Date(completed)
        afterEnd.setDate(afterEnd.getDate() + 14)
        // Don't go beyond latest available date
        if (afterEnd > latestAvailableDate) {
          afterEnd = latestAvailableDate
        }
      }
    }

    // Fetch snapshots from database
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .eq('video_id', videoId)
      .order('day', { ascending: true })

    if (snapshotsError) {
      logError(snapshotsError, {
        route: 'GET /api/experiments/[id]/analytics',
        userId: user.id,
        experimentId: id,
        operation: 'fetch-snapshots',
      })
      return databaseErrorResponse('Failed to fetch analytics snapshots')
    }

    // Parse and filter snapshots by date ranges
    const parseSnapshot = (snapshot: { day: string; metrics: unknown }): AnalyticsSnapshot | null => {
      try {
        const metrics = snapshot.metrics as {
          views?: number
          estimatedMinutesWatched?: number
          averageViewDuration?: number
          likes?: number
          subscribersGained?: number
        }

        return {
          day: snapshot.day,
          views: metrics.views || 0,
          estimatedMinutesWatched: metrics.estimatedMinutesWatched || 0,
          averageViewDuration: metrics.averageViewDuration || 0,
          likes: metrics.likes || 0,
          subscribersGained: metrics.subscribersGained || 0,
        }
      } catch {
        return null
      }
    }

    const allSnapshots = (snapshots || [])
      .map(parseSnapshot)
      .filter((s): s is AnalyticsSnapshot => s !== null)

    const filterByDateRange = (start: Date | null, end: Date | null): AnalyticsSnapshot[] => {
      if (!start || !end) return []
      return allSnapshots.filter((snapshot) => {
        const day = new Date(snapshot.day)
        return day >= start && day <= end
      })
    }

    const before = filterByDateRange(beforeStart, beforeEnd)
    const during = filterByDateRange(duringStart, duringEnd)
    const after = filterByDateRange(afterStart, afterEnd)

    // Calculate deltas and rates
    const calculateDeltas = (snapshots: AnalyticsSnapshot[]) => {
      const totalViews = snapshots.reduce((sum, s) => sum + s.views, 0)
      const totalMinutes = snapshots.reduce((sum, s) => sum + s.estimatedMinutesWatched, 0)
      const avgMinutesPerView = totalViews > 0 ? totalMinutes / totalViews : 0

      return {
        totalViews,
        totalMinutes,
        avgMinutesPerView,
      }
    }

    const deltas = {
      before: calculateDeltas(before),
      during: calculateDeltas(during),
      after: calculateDeltas(after),
    }

    const response: AnalyticsTimeSeries = {
      before,
      during,
      after,
      deltas,
    }

    return NextResponse.json(response)
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'fetch-experiment-analytics', undefined, 'Failed to fetch experiment analytics')
  }
}
