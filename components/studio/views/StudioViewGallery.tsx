"use client";

/**
 * StudioViewGallery
 * Gallery view - displays all generated thumbnails with sorting and filtering.
 * Uses local state for sorting/filtering preferences separate from generator view.
 */

import React, { useState, useCallback, memo, useMemo } from "react";
import { ViewControls, ViewHeader, type FilterOption, type SortOption } from "@/components/studio/view-controls";
import { ThumbnailGrid } from "@/components/studio/thumbnail-grid";
import { GridZoomSlider } from "@/components/studio/grid-zoom-slider";
import { LoadMoreButton } from "@/components/studio/load-more-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Grid3x3, RefreshCw } from "lucide-react";
import { useThumbnails } from "@/lib/hooks/useThumbnails";
import { useProjects } from "@/lib/hooks/useProjects";
import { useAuth } from "@/lib/hooks/useAuth";
import { useGridZoom } from "@/lib/hooks/useGridZoom";
import { getMasonryBreakpointCols } from "@/lib/utils/grid-zoom";
import { getClickRankBorderMap } from "@/lib/utils/click-rank-borders";
import type { ThumbnailSortOption, SortDirection } from "@/lib/hooks/useThumbnails";

const GALLERY_PROJECT_NONE = "__none__";
const GALLERY_PROJECT_ALL = "all";

const GALLERY_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "most-clicks", label: "Most Clicks" },
  { value: "title-asc", label: "Title A-Z" },
  { value: "title-desc", label: "Title Z-A" },
];

function parseGallerySortValue(value: string): { orderBy: ThumbnailSortOption; orderDirection: SortDirection } {
  switch (value) {
    case "oldest":
      return { orderBy: "created_at", orderDirection: "asc" };
    case "most-clicks":
      return { orderBy: "share_click_count", orderDirection: "desc" };
    case "title-asc":
      return { orderBy: "title", orderDirection: "asc" };
    case "title-desc":
      return { orderBy: "title", orderDirection: "desc" };
    case "newest":
    default:
      return { orderBy: "created_at", orderDirection: "desc" };
  }
}

function StudioViewGallery() {
  const { user, isAuthenticated } = useAuth();
  const { projects } = useProjects();
  const [zoomLevel, , handleZoomChange] = useGridZoom("studio-gallery-zoom");

  const [sortValue, setSortValue] = useState("newest");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>(GALLERY_PROJECT_ALL);

  const { orderBy, orderDirection } = useMemo(() => parseGallerySortValue(sortValue), [sortValue]);

  const projectIdForQuery = useMemo(
    () =>
      projectFilter === GALLERY_PROJECT_ALL ? undefined : projectFilter === GALLERY_PROJECT_NONE ? GALLERY_PROJECT_NONE : projectFilter,
    [projectFilter]
  );

  const projectFilterOptions: FilterOption[] = useMemo(
    () => [
      { value: GALLERY_PROJECT_ALL, label: "All projects" },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects]
  );

  const {
    thumbnails: allThumbnails,
    totalCount,
    isLoading,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useThumbnails({
    userId: user?.id,
    enabled: isAuthenticated,
    limit: 24,
    orderBy,
    orderDirection,
    favoritesOnly,
    projectId: projectIdForQuery,
  });

  const thumbnails = useMemo(() => {
    if (!searchQuery.trim()) return allThumbnails;
    const query = searchQuery.toLowerCase();
    return allThumbnails.filter(
      (t) => t.name?.toLowerCase().includes(query) || t.prompt?.toLowerCase().includes(query)
    );
  }, [allThumbnails, searchQuery]);

  const clickRankBorderById = useMemo(
    () => getClickRankBorderMap(thumbnails),
    [thumbnails]
  );

  const breakpointCols = useMemo(
    () => getMasonryBreakpointCols(zoomLevel),
    [zoomLevel]
  );

  const handleSortChange = useCallback((value: string) => setSortValue(value), []);
  const handleFavoritesToggle = useCallback((newFavoritesOnly: boolean) => setFavoritesOnly(newFavoritesOnly), []);
  const handleProjectFilterChange = useCallback((value: string) => setProjectFilter(value), []);
  const handleSearchChange = useCallback((query: string) => setSearchQuery(query), []);
  const handleRefresh = useCallback(() => refetch(), [refetch]);

  if (isError) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold">Gallery</h1>
          <p className="text-muted-foreground">All your generated thumbnails</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Failed to load thumbnails"}
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
    <div>
      <ViewHeader
        title="Gallery"
        description="All your generated thumbnails"
        count={searchQuery ? thumbnails.length : totalCount}
        countLabel="thumbnails"
      />
      <ViewControls
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search thumbnails..."
        showSearch={true}
        showFilter={true}
        filterValue={projectFilter}
        filterOptions={projectFilterOptions}
        onFilterChange={handleProjectFilterChange}
        sortValue={sortValue}
        sortOptions={GALLERY_SORT_OPTIONS}
        onSortChange={handleSortChange}
        showSort={true}
        favoritesOnly={favoritesOnly}
        onFavoritesToggle={handleFavoritesToggle}
        showFavorites={true}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
        showRefresh={true}
        showAdd={false}
        className="mb-6"
      />
      {!isLoading && thumbnails.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Grid3x3 className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {favoritesOnly
                ? "No favorite thumbnails yet. Mark some thumbnails as favorites to see them here!"
                : "No thumbnails yet. Generate some to see them here!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ThumbnailGrid
            thumbnails={thumbnails}
            isLoading={isLoading}
            minSlots={12}
            showEmptySlots={false}
            clickRankBorderById={clickRankBorderById}
            breakpointCols={breakpointCols}
          />
          {hasNextPage && (
            <LoadMoreButton
              onLoadMore={() => fetchNextPage()}
              loading={isFetchingNextPage}
              className="mt-6"
            />
          )}
        </>
      )}
    </div>
  );
}

export default memo(StudioViewGallery);
