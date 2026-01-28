"use client";

/**
 * Public Content Hooks
 * 
 * React Query integration for fetching public content (thumbnails, styles, palettes).
 * Features:
 * - Automatic request deduplication (client-swr-dedup)
 * - Caching with 5-minute stale time (public data changes less frequently)
 * - Client-side search filtering
 * - Sorting support
 * 
 * @see vercel-react-best-practices for client-swr-dedup pattern
 */

import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { getPublicThumbnails } from "@/lib/services/thumbnails";
import { getPublicStyles } from "@/lib/services/styles";
import { getPublicPalettes } from "@/lib/services/palettes";
import { mapDbThumbnailToThumbnail } from "@/lib/types/database";
import type { Thumbnail, DbThumbnail, PublicStyle, PublicPalette } from "@/lib/types/database";

/**
 * Sort options for public content
 */
export type PublicSortOption = 'created_at' | 'name' | 'like_count';
export type SortDirection = 'asc' | 'desc';

/**
 * Query key parameters
 */
export interface PublicContentQueryParams {
  orderBy?: PublicSortOption;
  orderDirection?: SortDirection;
}

/**
 * Query keys for cache management
 */
export const publicContentQueryKeys = {
  all: ["public"] as const,
  thumbnails: (params?: PublicContentQueryParams) =>
    [...publicContentQueryKeys.all, "thumbnails", params] as const,
  styles: (params?: PublicContentQueryParams) =>
    [...publicContentQueryKeys.all, "styles", params] as const,
  palettes: (params?: PublicContentQueryParams) =>
    [...publicContentQueryKeys.all, "palettes", params] as const,
};

/**
 * Client-side sorting helper
 */
function sortItems<T extends { created_at?: string; name?: string; like_count?: number }>(
  items: T[],
  orderBy: PublicSortOption,
  orderDirection: SortDirection
): T[] {
  const sorted = [...items].sort((a, b) => {
    let comparison = 0;
    
    switch (orderBy) {
      case 'created_at':
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        comparison = dateA - dateB;
        break;
      case 'name':
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        comparison = nameA.localeCompare(nameB);
        break;
      case 'like_count':
        comparison = (a.like_count || 0) - (b.like_count || 0);
        break;
    }
    
    return orderDirection === 'desc' ? -comparison : comparison;
  });
  
  return sorted;
}

/**
 * Client-side search filter helper
 */
function filterBySearch<T extends { name?: string; title?: string; description?: string | null }>(
  items: T[],
  searchQuery: string
): T[] {
  if (!searchQuery.trim()) return items;
  
  const query = searchQuery.toLowerCase().trim();
  return items.filter((item) => {
    const name = (item.name || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    const description = (item.description || '').toLowerCase();
    return name.includes(query) || title.includes(query) || description.includes(query);
  });
}

// ============================================================================
// Public Thumbnails Hook
// ============================================================================

export interface UsePublicThumbnailsOptions {
  limit?: number;
  orderBy?: PublicSortOption;
  orderDirection?: SortDirection;
  searchQuery?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching public thumbnails with pagination
 */
export function usePublicThumbnails({
  limit = 24,
  orderBy = "created_at",
  orderDirection = "desc",
  searchQuery = "",
  enabled = true,
}: UsePublicThumbnailsOptions = {}) {
  const queryClient = useQueryClient();
  
  const queryParams: PublicContentQueryParams = { orderBy, orderDirection };

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
    queryKey: publicContentQueryKeys.thumbnails(queryParams),
    queryFn: async ({ pageParam = 0 }) => {
      const result = await getPublicThumbnails({
        limit,
        offset: pageParam as number,
      });

      if (result.error) {
        throw result.error;
      }

      return {
        thumbnails: result.thumbnails,
        count: result.count,
        nextOffset: (pageParam as number) + limit,
        hasMore: (pageParam as number) + limit < result.count,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextOffset : undefined,
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes (public data changes less frequently)
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  // Flatten pages and convert to Thumbnail type
  const allThumbnails = useMemo(() => {
    return data?.pages.flatMap((page) =>
      page.thumbnails.map(mapDbThumbnailToThumbnail)
    ) ?? [];
  }, [data]);

  // Apply client-side sorting and filtering
  const thumbnails = useMemo(() => {
    let result = allThumbnails;
    
    // Apply search filter
    result = filterBySearch(result, searchQuery);
    
    // Apply sorting (API returns by created_at desc, so we may need to re-sort)
    if (orderBy !== 'created_at' || orderDirection !== 'desc') {
      result = sortItems(result, orderBy, orderDirection);
    }
    
    return result;
  }, [allThumbnails, searchQuery, orderBy, orderDirection]);

  const totalCount = data?.pages[0]?.count ?? 0;

  // Prefetch next page on hover/focus
  const prefetchNextPage = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    thumbnails,
    totalCount,
    filteredCount: thumbnails.length,
    isLoading,
    isError,
    error,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    fetchNextPage,
    prefetchNextPage,
    refetch,
  };
}

// ============================================================================
// Public Styles Hook
// ============================================================================

export interface UsePublicStylesOptions {
  orderBy?: PublicSortOption;
  orderDirection?: SortDirection;
  searchQuery?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching public styles
 */
export function usePublicStyles({
  orderBy = "like_count",
  orderDirection = "desc",
  searchQuery = "",
  enabled = true,
}: UsePublicStylesOptions = {}) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: publicContentQueryKeys.styles({ orderBy, orderDirection }),
    queryFn: async () => {
      const result = await getPublicStyles();

      if (result.error) {
        throw result.error;
      }

      return result.styles;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  // Apply client-side sorting and filtering
  const styles = useMemo(() => {
    let result = data ?? [];
    
    // Apply search filter
    result = filterBySearch(result, searchQuery);
    
    // Apply sorting
    result = sortItems(result, orderBy, orderDirection);
    
    return result;
  }, [data, searchQuery, orderBy, orderDirection]);

  const totalCount = data?.length ?? 0;

  return {
    styles,
    totalCount,
    filteredCount: styles.length,
    isLoading,
    isError,
    error,
    refetch,
  };
}

// ============================================================================
// Public Palettes Hook
// ============================================================================

export interface UsePublicPalettesOptions {
  orderBy?: PublicSortOption;
  orderDirection?: SortDirection;
  searchQuery?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching public palettes
 */
export function usePublicPalettes({
  orderBy = "like_count",
  orderDirection = "desc",
  searchQuery = "",
  enabled = true,
}: UsePublicPalettesOptions = {}) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: publicContentQueryKeys.palettes({ orderBy, orderDirection }),
    queryFn: async () => {
      const result = await getPublicPalettes();

      if (result.error) {
        throw result.error;
      }

      return result.palettes;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  // Apply client-side sorting and filtering
  const palettes = useMemo(() => {
    let result = data ?? [];
    
    // Apply search filter
    result = filterBySearch(result, searchQuery);
    
    // Apply sorting
    result = sortItems(result, orderBy, orderDirection);
    
    return result;
  }, [data, searchQuery, orderBy, orderDirection]);

  const totalCount = data?.length ?? 0;

  return {
    palettes,
    totalCount,
    filteredCount: palettes.length,
    isLoading,
    isError,
    error,
    refetch,
  };
}

// ============================================================================
// Prefetch Helpers
// ============================================================================

/**
 * Hook for prefetching public content (useful for tab hover)
 */
export function usePrefetchPublicContent() {
  const queryClient = useQueryClient();

  const prefetchThumbnails = useCallback(() => {
    queryClient.prefetchInfiniteQuery({
      queryKey: publicContentQueryKeys.thumbnails({ orderBy: 'created_at', orderDirection: 'desc' }),
      queryFn: async () => {
        const result = await getPublicThumbnails({ limit: 24, offset: 0 });
        if (result.error) throw result.error;
        return {
          thumbnails: result.thumbnails,
          count: result.count,
          nextOffset: 24,
          hasMore: 24 < result.count,
        };
      },
      initialPageParam: 0,
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  const prefetchStyles = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: publicContentQueryKeys.styles({ orderBy: 'like_count', orderDirection: 'desc' }),
      queryFn: async () => {
        const result = await getPublicStyles();
        if (result.error) throw result.error;
        return result.styles;
      },
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  const prefetchPalettes = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: publicContentQueryKeys.palettes({ orderBy: 'like_count', orderDirection: 'desc' }),
      queryFn: async () => {
        const result = await getPublicPalettes();
        if (result.error) throw result.error;
        return result.palettes;
      },
      staleTime: 1000 * 60 * 5,
    });
  }, [queryClient]);

  return {
    prefetchThumbnails,
    prefetchStyles,
    prefetchPalettes,
  };
}
