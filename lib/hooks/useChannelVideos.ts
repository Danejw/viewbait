"use client";

/**
 * useChannelVideos
 *
 * Fetches public YouTube channel videos via the server proxy (/api/youtube/channel-videos).
 * Uses React Query useInfiniteQuery for caching so that navigating away and back
 * restores the grid without refetching. Call fetchVideos(urlOrChannelId) when the user
 * submits; loadMore() for pagination; reset() to clear; refetch() to retry or refresh.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { logClientError, logClientInfo } from "@/lib/utils/client-logger";

// Match proxy response shape (optionally with stats)
export interface ChannelVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount?: number;
  likeCount?: number;
}

export interface UseChannelVideosState {
  videos: ChannelVideo[];
  hasMore: boolean;
  nextPageToken: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  /** Last submitted query (url or channelId) for loadMore / cache key */
  currentQuery: string | null;
}

export interface UseChannelVideosOptions {
  /** Restore from sessionStorage: when tab passes saved query, hook enables query and uses cache */
  initialQuery?: string | null;
}

export interface UseChannelVideosReturn extends UseChannelVideosState {
  /** Fetch first page for the given URL or channel ID (sets submittedQuery; query runs or serves cache). */
  fetchVideos: (urlOrChannelId: string) => void;
  /** Append next page (uses currentQuery and nextPageToken). */
  loadMore: () => Promise<void>;
  /** Clear state and remove this query from cache so next load refetches. */
  reset: () => void;
  /** Refetch current query (for Try again or refresh same URL). */
  refetch: () => void;
}

/** Query keys for cache management */
export const channelVideosQueryKeys = {
  all: ["channel-videos"] as const,
  list: (normalizedQuery: string) =>
    [...channelVideosQueryKeys.all, normalizedQuery] as const,
};

function isChannelId(value: string): boolean {
  return /^UC[\w-]{21,}$/i.test(value.trim());
}

function buildParams(query: string, pageToken?: string | null): URLSearchParams {
  const params = new URLSearchParams();
  if (isChannelId(query)) params.set("channelId", query);
  else params.set("url", query);
  if (pageToken) params.set("pageToken", pageToken);
  return params;
}

async function fetchChannelVideosPage(
  query: string,
  pageToken?: string | null
): Promise<{
  videos: ChannelVideo[];
  nextPageToken: string | null;
  hasMore: boolean;
}> {
  const params = buildParams(query, pageToken);
  const response = await fetch(`/api/youtube/channel-videos?${params.toString()}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch channel videos");
  }
  return {
    videos: (data.videos ?? []) as ChannelVideo[],
    nextPageToken: data.nextPageToken ?? null,
    hasMore: !!data.hasMore,
  };
}

const STALE_TIME_MS = 10 * 60 * 1000; // 10 minutes
const GC_TIME_MS = 30 * 60 * 1000; // 30 minutes

export function useChannelVideos(
  options: UseChannelVideosOptions = {}
): UseChannelVideosReturn {
  const { initialQuery } = options;
  const queryClient = useQueryClient();

  const [submittedQuery, setSubmittedQuery] = useState<string | null>(() =>
    initialQuery != null && initialQuery.trim() !== ""
      ? initialQuery.trim()
      : null
  );

  // Restore when tab passes saved query after mount (e.g. from sessionStorage)
  useEffect(() => {
    if (
      initialQuery != null &&
      initialQuery.trim() !== "" &&
      submittedQuery === null
    ) {
      setSubmittedQuery(initialQuery.trim());
    }
  }, [initialQuery, submittedQuery]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch: rqRefetch,
  } = useInfiniteQuery({
    queryKey: channelVideosQueryKeys.list(submittedQuery ?? ""),
    queryFn: async ({ pageParam }) => {
      if (!submittedQuery) throw new Error("No query");
      const result = await fetchChannelVideosPage(
        submittedQuery,
        pageParam ?? undefined
      );
      logClientInfo("Channel videos fetched", {
        operation: "fetch-channel-videos",
        component: "useChannelVideos",
        count: result.videos.length,
        hasMore: result.hasMore,
      });
      return result;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextPageToken : undefined,
    enabled: !!submittedQuery,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });

  const videos = useMemo(
    () => data?.pages.flatMap((p) => p.videos) ?? [],
    [data]
  );
  const nextPageToken =
    data?.pages.length && data.pages[data.pages.length - 1]
      ? data.pages[data.pages.length - 1].nextPageToken
      : null;

  const fetchVideos = useCallback((urlOrChannelId: string) => {
    const input = urlOrChannelId.trim();
    if (!input) return;
    setSubmittedQuery(input);
  }, []);

  const loadMore = useCallback(async () => {
    await fetchNextPage();
  }, [fetchNextPage]);

  const reset = useCallback(() => {
    const previous = submittedQuery;
    setSubmittedQuery(null);
    if (previous != null) {
      queryClient.removeQueries({
        queryKey: channelVideosQueryKeys.list(previous),
      });
    }
  }, [submittedQuery, queryClient]);

  const refetch = useCallback(() => {
    rqRefetch();
  }, [rqRefetch]);

  const errorMessage =
    isError && error
      ? error instanceof Error
        ? error.message
        : "Failed to fetch channel videos"
      : null;

  return {
    videos,
    hasMore: hasNextPage ?? false,
    nextPageToken,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    error: errorMessage,
    currentQuery: submittedQuery,
    fetchVideos,
    loadMore,
    reset,
    refetch,
  };
}
