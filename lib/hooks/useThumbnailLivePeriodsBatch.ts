"use client";

/**
 * useThumbnailLivePeriodsBatch
 *
 * Fetches live periods for multiple thumbnail IDs in one request and populates
 * the per-id React Query cache so ThumbnailLivePerformanceBlock reads from cache.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import * as thumbnailsService from "@/lib/services/thumbnails";
import type { ThumbnailLivePeriod } from "@/lib/types/database";

const QUERY_KEY_BATCH = ["thumbnail-live-periods", "batch"] as const;
const STALE_MS = 2 * 60 * 1000;

export interface UseThumbnailLivePeriodsBatchOptions {
  thumbnailIds: string[];
  enabled?: boolean;
}

/**
 * Fetches live periods for the given IDs in one batch and writes each result
 * into the cache under ["thumbnail-live-periods", id] so ThumbnailLivePerformanceBlock
 * gets cache hits.
 */
export function useThumbnailLivePeriodsBatch({
  thumbnailIds,
  enabled = true,
}: UseThumbnailLivePeriodsBatchOptions) {
  const queryClient = useQueryClient();
  const deduped = Array.from(new Set(thumbnailIds)).filter(Boolean).slice(0, 20);

  const query = useQuery({
    queryKey: [...QUERY_KEY_BATCH, deduped.join(",")],
    queryFn: () => thumbnailsService.getThumbnailLivePeriodsBatch(deduped),
    enabled: enabled && deduped.length > 0,
    staleTime: STALE_MS,
  });

  useEffect(() => {
    if (!query.data?.periodsByThumbnailId || query.error) return;
    const map = query.data.periodsByThumbnailId as Record<string, ThumbnailLivePeriod[]>;
    for (const id of deduped) {
      const periods = map[id] ?? [];
      queryClient.setQueryData(
        ["thumbnail-live-periods", id],
        { periods, error: null }
      );
    }
  }, [query.data, query.error, deduped, queryClient]);

  return {
    isLoading: query.isLoading,
    error: query.error,
    isFetched: query.isFetched,
  };
}
