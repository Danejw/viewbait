"use client";

/**
 * useYouTubeVideosList
 *
 * React Query–backed list of the authenticated user's YouTube videos.
 * Shared cache so SetOnYouTubeModal and YouTube view don't duplicate requests.
 * Pass enabled: false to avoid fetching until needed (e.g. only when on YouTube tab or modal open).
 */

import { useCallback, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/useAuth";

export interface YouTubeVideoItem {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount?: number;
  likeCount?: number;
  durationSeconds?: number;
}

const STALE_TIME_MS = 2 * 60 * 1000; // 2 minutes
const QUERY_KEY = ["youtube", "videos"] as const;

function dedupeById(videos: YouTubeVideoItem[]): YouTubeVideoItem[] {
  const seen = new Set<string>();
  return videos.filter((v) => {
    if (!v.videoId || seen.has(v.videoId)) return false;
    seen.add(v.videoId);
    return true;
  });
}

async function fetchPage(pageToken: string | null): Promise<{
  videos: YouTubeVideoItem[];
  nextPageToken: string | null;
  hasMore: boolean;
}> {
  const url = pageToken
    ? `/api/youtube/videos?pageToken=${encodeURIComponent(pageToken)}`
    : "/api/youtube/videos";
  const response = await fetch(url, { credentials: "include" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch videos");
  }
  const videos = Array.isArray(data.videos) ? data.videos : [];
  return {
    videos: dedupeById(videos),
    nextPageToken: data.nextPageToken ?? null,
    hasMore: !!data.hasMore,
  };
}

export interface UseYouTubeVideosListOptions {
  /** When false, the query does not run. Default true. Use to gate fetching by view or modal open. */
  enabled?: boolean;
}

export interface UseYouTubeVideosListReturn {
  videos: YouTubeVideoItem[];
  hasMore: boolean;
  nextPageToken: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<unknown>;
  loadMore: () => Promise<void>;
}

export function useYouTubeVideosList(
  options: UseYouTubeVideosListOptions = {}
): UseYouTubeVideosListReturn {
  const { enabled = true } = options;
  const { isAuthenticated } = useAuth();

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ pageParam }) => fetchPage(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextPageToken : undefined,
    enabled: isAuthenticated && enabled,
    staleTime: STALE_TIME_MS,
    gcTime: 10 * 60 * 1000,
  });

  const videos = useMemo(
    () => data?.pages.flatMap((p) => p.videos) ?? [],
    [data]
  );
  const nextPageToken =
    data?.pages?.length && data.pages[data.pages.length - 1]
      ? data.pages[data.pages.length - 1].nextPageToken
      : null;

  const loadMore = useCallback(async () => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    videos,
    hasMore: hasNextPage ?? false,
    nextPageToken,
    isLoading,
    isRefreshing: isFetching && !isFetchingNextPage,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refetch,
    loadMore,
  };
}
