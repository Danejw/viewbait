"use client";

/**
 * BrowseThumbnails Component
 * 
 * Tab content for browsing public thumbnails with:
 * - Search and sort controls
 * - Optimized thumbnail grid
 * - Load more pagination
 * - Empty states
 * 
 * ThumbnailCard handles its own actions via useThumbnailActions hook,
 * so no action callbacks need to be passed through this component.
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useState, useCallback } from "react";
import { RefreshCw, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyStateCard } from "@/components/ui/empty-state-card";
import { LoadMoreButton } from "./load-more-button";
import { getErrorMessage } from "@/lib/utils/error";
import { BrowseControls } from "./browse-controls";
import { ThumbnailGrid } from "./thumbnail-grid";
import { usePublicThumbnails } from "@/lib/hooks/usePublicContent";
import type { PublicSortOption, SortDirection } from "@/lib/hooks/usePublicContent";

/**
 * BrowseThumbnails - memoized for performance
 * ThumbnailCard handles its own actions (click, edit, delete, etc.) via context
 */
export const BrowseThumbnails = memo(function BrowseThumbnails() {
  // Local state for sorting and filtering
  const [orderBy, setOrderBy] = useState<PublicSortOption>("created_at");
  const [orderDirection, setOrderDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch public thumbnails
  const {
    thumbnails,
    totalCount,
    filteredCount,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = usePublicThumbnails({
    orderBy,
    orderDirection,
    searchQuery,
    limit: 24,
  });

  // Handle sort change
  const handleSortChange = useCallback(
    (newOrderBy: PublicSortOption, newOrderDirection: SortDirection) => {
      setOrderBy(newOrderBy);
      setOrderDirection(newOrderDirection);
    },
    []
  );

  // Handle search change
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Error state
  if (isError) {
    return (
      <div className="space-y-4">
        <BrowseControls
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          orderBy={orderBy}
          orderDirection={orderDirection}
          onSortChange={handleSortChange}
          searchPlaceholder="Search thumbnails..."
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">
              {getErrorMessage(error, "Failed to load thumbnails")}
            </p>
            <Button variant="outline" onClick={handleRefresh} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <BrowseControls
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        orderBy={orderBy}
        orderDirection={orderDirection}
        onSortChange={handleSortChange}
        totalCount={totalCount}
        filteredCount={searchQuery ? filteredCount : undefined}
        searchPlaceholder="Search thumbnails..."
      />

      {/* Empty state */}
      {!isLoading && thumbnails.length === 0 ? (
        <EmptyStateCard
          icon={<ImageIcon />}
          title={
            searchQuery
              ? "No thumbnails match your search"
              : "No public thumbnails available"
          }
        />
      ) : (
        <>
          {/* Thumbnail grid - ThumbnailCard handles all actions via context */}
          <ThumbnailGrid
            thumbnails={thumbnails}
            isLoading={isLoading}
            minSlots={12}
            showEmptySlots={false}
          />

          {hasNextPage && (
            <LoadMoreButton
              onLoadMore={() => fetchNextPage()}
              loading={isFetchingNextPage}
            />
          )}
        </>
      )}
    </div>
  );
});

export default BrowseThumbnails;
