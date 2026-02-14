/**
 * useExperimentAnalytics Hook
 *
 * React Query hook for polling experiment analytics sync.
 * Polling pauses when the tab is hidden; refetchOnWindowFocus refreshes when the user returns.
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as experimentsService from '@/lib/services/experiments'
import { logClientError } from '@/lib/utils/client-logger'

export interface UseExperimentAnalyticsOptions {
  videoId: string
  enabled: boolean
  refetchInterval?: number // Default: 5 minutes
}

/**
 * Hook for syncing experiment analytics with automatic polling.
 * Polling runs only when the tab is visible; no requests while hidden.
 *
 * @param options.videoId - Video ID to sync analytics for
 * @param options.enabled - Whether polling should be enabled (typically based on experiment status)
 * @param options.refetchInterval - Polling interval in ms when visible (default: 5 minutes)
 * @returns Query result with sync status
 */
export function useExperimentAnalytics({
  videoId,
  enabled,
  refetchInterval = 5 * 60 * 1000, // 5 minutes
}: UseExperimentAnalyticsOptions) {
  const [isTabVisible, setIsTabVisible] = useState(true)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibilityChange = () => {
      setIsTabVisible(document.visibilityState !== 'hidden')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return useQuery({
    queryKey: ['experiment-analytics', videoId],
    queryFn: async () => {
      try {
        const result = await experimentsService.syncAnalytics([videoId])
        return result
      } catch (error) {
        logClientError(error, {
          component: 'useExperimentAnalytics',
          operation: 'syncAnalytics',
        })
        throw error
      }
    },
    enabled: enabled && !!videoId,
    refetchInterval: enabled && isTabVisible ? refetchInterval : false,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}
