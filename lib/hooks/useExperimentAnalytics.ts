/**
 * useExperimentAnalytics Hook
 * 
 * React Query hook for polling experiment analytics sync.
 * Uses refetchInterval for declarative polling instead of manual setInterval.
 */

import { useQuery } from '@tanstack/react-query'
import * as experimentsService from '@/lib/services/experiments'
import { logClientError } from '@/lib/utils/client-logger'

export interface UseExperimentAnalyticsOptions {
  videoId: string
  enabled: boolean
  refetchInterval?: number // Default: 5 minutes
}

/**
 * Hook for syncing experiment analytics with automatic polling
 * 
 * @param options - Configuration options
 * @param options.videoId - Video ID to sync analytics for
 * @param options.enabled - Whether polling should be enabled (typically based on experiment status)
 * @param options.refetchInterval - Polling interval in milliseconds (default: 5 minutes)
 * @returns Query result with sync status
 */
export function useExperimentAnalytics({
  videoId,
  enabled,
  refetchInterval = 5 * 60 * 1000, // 5 minutes
}: UseExperimentAnalyticsOptions) {
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
    refetchInterval: enabled ? refetchInterval : false,
    // Don't refetch on mount if data is fresh (within staleTime)
    refetchOnMount: false,
    // Don't refetch on window focus
    refetchOnWindowFocus: false,
    // Don't refetch on reconnect (we have polling)
    refetchOnReconnect: false,
    // Retry on failure
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}
