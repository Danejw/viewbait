"use client";

/**
 * Thumbnails Query Hook
 * 
 * React Query integration for fetching thumbnails with:
 * - Automatic request deduplication (client-swr-dedup)
 * - Background refetching
 * - Cursor-based pagination
 * - Optimistic updates for favorites
 * 
 * @see vercel-react-best-practices for client-swr-dedup pattern
 */

import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { getThumbnails, deleteThumbnail, toggleThumbnailFavorite } from "@/lib/services/thumbnails";
import { mapDbThumbnailToThumbnail } from "@/lib/types/database";
import type { DbThumbnail, Thumbnail } from "@/lib/types/database";

/**
 * Sorting options type
 */
export type ThumbnailSortOption = 'created_at' | 'title';
export type SortDirection = 'asc' | 'desc';

/**
 * Query key parameters for cache management
 */
export interface ThumbnailsQueryParams {
  favoritesOnly?: boolean;
  orderBy?: ThumbnailSortOption;
  orderDirection?: SortDirection;
  /** When set, filter by project. null/omit = All thumbnails */
  projectId?: string | null;
}

/**
 * Query keys for cache management
 * Includes sorting parameters for proper cache differentiation
 */
export const thumbnailsQueryKeys = {
  all: ["thumbnails"] as const,
  list: (params: ThumbnailsQueryParams) =>
    [...thumbnailsQueryKeys.all, "list", params] as const,
  detail: (id: string) => [...thumbnailsQueryKeys.all, "detail", id] as const,
};

/**
 * Fetch options
 */
export interface UseThumbnailsOptions {
  userId?: string;
  limit?: number;
  favoritesOnly?: boolean;
  orderBy?: ThumbnailSortOption;
  orderDirection?: SortDirection;
  /** When set, filter thumbnails by this project. null/omit = All thumbnails */
  projectId?: string | null;
  enabled?: boolean;
}

/**
 * Hook for fetching thumbnails with infinite scroll support
 * Uses React Query for automatic deduplication and caching
 * 
 * @param options - Fetch options including sorting parameters
 * @returns Thumbnails data and query state
 */
export function useThumbnails({
  userId,
  limit = 24,
  favoritesOnly = false,
  orderBy = "created_at",
  orderDirection = "desc",
  enabled = true,
  projectId,
}: UseThumbnailsOptions = {}) {
  const queryClient = useQueryClient();

  // Build query params for cache key - includes all filter/sort options
  const queryParams: ThumbnailsQueryParams = {
    favoritesOnly,
    orderBy,
    orderDirection,
    projectId,
  };

  // Use infinite query for cursor-based pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: thumbnailsQueryKeys.list(queryParams),
    queryFn: async ({ pageParam = null }) => {
      if (!userId) {
        return {
          thumbnails: [] as DbThumbnail[],
          count: 0,
          nextCursor: null,
          hasNextPage: false,
        };
      }

      const result = await getThumbnails(userId, {
        limit,
        cursor: pageParam as string | null,
        favoritesOnly,
        orderBy,
        orderDirection,
        projectId: projectId ?? undefined,
      });

      if (result.error) {
        throw result.error;
      }

      return {
        thumbnails: result.thumbnails,
        count: result.count,
        nextCursor: result.nextCursor ?? null,
        hasNextPage: result.hasNextPage,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextCursor : undefined,
    enabled: enabled && !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  // Flatten pages into single array
  const thumbnails: Thumbnail[] =
    data?.pages.flatMap((page) =>
      page.thumbnails.map(mapDbThumbnailToThumbnail)
    ) ?? [];

  const totalCount = data?.pages[0]?.count ?? 0;

  // Invalidate thumbnails query (for refresh after generation)
  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: thumbnailsQueryKeys.list(queryParams),
    });
  }, [queryClient, queryParams]);

  // Refetch first page only (more efficient than full invalidate)
  const refreshFirstPage = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: thumbnailsQueryKeys.list(queryParams),
      refetchType: "all",
    });
  }, [queryClient, queryParams]);

  // Invalidate all thumbnail queries (useful when sorting/filtering changes externally)
  const invalidateAll = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: thumbnailsQueryKeys.all,
    });
  }, [queryClient]);

  return {
    thumbnails,
    totalCount,
    isLoading,
    isError,
    error,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    invalidate,
    invalidateAll,
    refreshFirstPage,
  };
}

/**
 * Hook for deleting a thumbnail
 */
export function useDeleteThumbnail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (thumbnailId: string) => {
      const result = await deleteThumbnail(thumbnailId);
      if (result.error) {
        throw result.error;
      }
      return thumbnailId;
    },
    onSuccess: (thumbnailId) => {
      // Optimistically remove from cache
      queryClient.setQueriesData(
        { queryKey: thumbnailsQueryKeys.all },
        (oldData: unknown) => {
          if (!oldData) return oldData;
          // Handle infinite query data structure
          if (typeof oldData === "object" && "pages" in oldData) {
            const infiniteData = oldData as {
              pages: Array<{ thumbnails: DbThumbnail[] }>;
              pageParams: unknown[];
            };
            return {
              ...infiniteData,
              pages: infiniteData.pages.map((page) => ({
                ...page,
                thumbnails: page.thumbnails.filter((t) => t.id !== thumbnailId),
              })),
            };
          }
          return oldData;
        }
      );
    },
  });
}

/**
 * Hook for toggling thumbnail favorite
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (thumbnailId: string) => {
      const result = await toggleThumbnailFavorite(thumbnailId);
      if (result.error) {
        throw result.error;
      }
      return { thumbnailId, liked: result.liked };
    },
    onMutate: async (thumbnailId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: thumbnailsQueryKeys.all });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({
        queryKey: thumbnailsQueryKeys.all,
      });

      // Optimistically update
      queryClient.setQueriesData(
        { queryKey: thumbnailsQueryKeys.all },
        (oldData: unknown) => {
          if (!oldData) return oldData;
          if (typeof oldData === "object" && "pages" in oldData) {
            const infiniteData = oldData as {
              pages: Array<{ thumbnails: DbThumbnail[] }>;
              pageParams: unknown[];
            };
            return {
              ...infiniteData,
              pages: infiniteData.pages.map((page) => ({
                ...page,
                thumbnails: page.thumbnails.map((t) =>
                  t.id === thumbnailId ? { ...t, liked: !t.liked } : t
                ),
              })),
            };
          }
          return oldData;
        }
      );

      return { previousData };
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
  });
}

/**
 * Hook for prefetching thumbnails (useful for hover preloading)
 */
export function usePrefetchThumbnails() {
  const queryClient = useQueryClient();

  return useCallback(
    (userId: string, options: ThumbnailsQueryParams = {}) => {
      const queryParams: ThumbnailsQueryParams = {
        favoritesOnly: options.favoritesOnly ?? false,
        orderBy: options.orderBy ?? "created_at",
        orderDirection: options.orderDirection ?? "desc",
        projectId: options.projectId ?? null,
      };

      return queryClient.prefetchInfiniteQuery({
        queryKey: thumbnailsQueryKeys.list(queryParams),
        queryFn: async () => {
          const result = await getThumbnails(userId, {
            limit: 24,
            favoritesOnly: queryParams.favoritesOnly,
            orderBy: queryParams.orderBy,
            orderDirection: queryParams.orderDirection,
            projectId: queryParams.projectId ?? undefined,
          });

          if (result.error) {
            throw result.error;
          }

          return {
            thumbnails: result.thumbnails,
            count: result.count,
            nextCursor: result.nextCursor ?? null,
            hasNextPage: result.hasNextPage,
          };
        },
        initialPageParam: null,
        staleTime: 1000 * 60 * 2,
      });
    },
    [queryClient]
  );
}
