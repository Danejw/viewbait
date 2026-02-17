"use client";

import React, { useCallback, memo, useMemo } from "react";
import { useStudio } from "./studio-provider";
import { ThumbnailGrid } from "./thumbnail-grid";
import { GridZoomSlider } from "@/components/studio/grid-zoom-slider";
import { getCombinedThumbnailsList } from "@/lib/utils/studio-thumbnails";
import { getClickRankBorderMap } from "@/lib/utils/click-rank-borders";
import { getMasonryBreakpointCols } from "@/lib/utils/grid-zoom";
import { useGridZoom } from "@/lib/hooks/useGridZoom";
import type { Thumbnail } from "@/lib/types/database";
import type { MasonryGridBreakpoints } from "@/components/studio/masonry-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { LoadMoreButton } from "@/components/studio/load-more-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RESULTS_SORT_OPTIONS = [
  { value: "newest", label: "Newest First", orderBy: "created_at" as const, orderDirection: "desc" as const },
  { value: "oldest", label: "Oldest First", orderBy: "created_at" as const, orderDirection: "asc" as const },
  { value: "most-clicks", label: "Most Clicks", orderBy: "share_click_count" as const, orderDirection: "desc" as const },
  { value: "title-asc", label: "Title A-Z", orderBy: "title" as const, orderDirection: "asc" as const },
  { value: "title-desc", label: "Title Z-A", orderBy: "title" as const, orderDirection: "desc" as const },
];

function getResultsSortValue(
  orderBy: string | undefined,
  orderDirection: string | undefined
): string {
  const option = RESULTS_SORT_OPTIONS.find(
    (o) => o.orderBy === (orderBy ?? "created_at") && o.orderDirection === (orderDirection ?? "desc")
  );
  return option?.value ?? "newest";
}

/**
 * StudioResultsHeader
 * Header for results panel with refresh button, grid zoom slider, and sort dropdown.
 * Project selection is in the right-hand sidebar above Manual/Chat tabs.
 */
export const StudioResultsHeader = memo(function StudioResultsHeader({
  gridZoomLevel,
  onGridZoomChange,
}: {
  gridZoomLevel?: number;
  onGridZoomChange?: (value: number[]) => void;
} = {}) {
  const { data, state, actions } = useStudio();
  const { refreshThumbnails, thumbnailsLoading } = data;
  const { resultsOrderBy, resultsOrderDirection } = state;
  const { setResultsSort } = actions;

  const sortValue = useMemo(
    () => getResultsSortValue(resultsOrderBy, resultsOrderDirection),
    [resultsOrderBy, resultsOrderDirection]
  );

  const handleSortChange = useCallback(
    (value: string) => {
      const option = RESULTS_SORT_OPTIONS.find((o) => o.value === value);
      if (option) setResultsSort(option.orderBy, option.orderDirection);
    },
    [setResultsSort]
  );

  const handleRefresh = useCallback(() => {
    refreshThumbnails();
  }, [refreshThumbnails]);

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="mb-2 text-2xl font-bold">Create Thumbnails</h2>
          <Button
            data-tour="tour.studio.results.results.btn.refresh"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={thumbnailsLoading}
            title="Refresh"
            className="h-9 w-9 shrink-0 p-0 sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-2"
          >
            {thumbnailsLoading ? (
              <ViewBaitLogo className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 shrink-0" />
            )}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {typeof gridZoomLevel === "number" && onGridZoomChange && (
            <GridZoomSlider value={gridZoomLevel} onValueChange={onGridZoomChange} />
          )}
          <Select value={sortValue} onValueChange={handleSortChange}>
            <SelectTrigger data-tour="tour.studio.results.results.select.sort" className="w-[180px]" aria-label="Sort results">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {RESULTS_SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
});

/**
 * StudioResultsError
 * Error display for generation or fetch errors
 */
export const StudioResultsError = memo(function StudioResultsError() {
  const { state, data, actions } = useStudio();
  const { generationError } = state;
  const { thumbnailsError } = data;
  const { clearError } = actions;

  const error = generationError || thumbnailsError?.message;

  if (!error) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        <Button variant="ghost" size="sm" onClick={clearError}>
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  );
});

/**
 * StudioResultsLoadMore
 * Load more button for pagination
 */
export const StudioResultsLoadMore = memo(function StudioResultsLoadMore() {
  const { data: studioData } = useStudio();
  const { hasNextPage, fetchNextPage, isFetchingNextPage } = studioData;

  if (!hasNextPage) return null;

  return (
    <LoadMoreButton
      onLoadMore={() => fetchNextPage()}
      loading={isFetchingNextPage}
      className="mt-6"
    />
  );
});

/**
 * Empty state when a project is selected but has no thumbnails yet
 */
const StudioResultsEmptyProject = memo(function StudioResultsEmptyProject() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <ViewBaitLogo className="mb-4 h-12 w-12" />
        <p className="text-muted-foreground">
          You have not created any thumbnails in this project yet.
        </p>
      </CardContent>
    </Card>
  );
});

/**
 * StudioResultsGrid
 * Optimized grid using ThumbnailGrid component
 * ThumbnailCard handles its own actions via useThumbnailActions hook
 * ImageModal is rendered globally in StudioProvider
 * When a project is selected and has no thumbnails, shows an empty-state message instead of skeletons.
 */
/** Single placeholder for CRT fallback when isGenerating but generatingItems not yet populated */
const FALLBACK_GENERATING_PLACEHOLDER: Thumbnail = {
  id: "generating-placeholder",
  name: "Creating thumbnail...",
  imageUrl: "",
  thumbnail400wUrl: null,
  thumbnail800wUrl: null,
  prompt: "Creating thumbnail...",
  isFavorite: false,
  isPublic: false,
  createdAt: new Date(),
  generating: true,
  resolution: "1K",
};

const FALLBACK_GENERATING_ITEMS = new Map<string, Thumbnail>([
  ["generating-placeholder", FALLBACK_GENERATING_PLACEHOLDER],
]);

export const StudioResultsGrid = memo(function StudioResultsGrid({
  breakpointCols,
}: {
  breakpointCols?: MasonryGridBreakpoints;
} = {}) {
  const { data: studioData, state } = useStudio();
  const { thumbnails, generatingItems, thumbnailsLoading } = studioData;
  const { activeProjectId, isGenerating } = state;

  const projectSelectedAndEmpty =
    activeProjectId &&
    thumbnails.length === 0 &&
    generatingItems.size === 0 &&
    !thumbnailsLoading &&
    !isGenerating;

  if (projectSelectedAndEmpty) {
    return <StudioResultsEmptyProject />;
  }

  const effectiveGeneratingItems =
    isGenerating && generatingItems.size === 0
      ? FALLBACK_GENERATING_ITEMS
      : generatingItems;
  const showEmptySlots =
    thumbnails.length === 0 && effectiveGeneratingItems.size === 0;

  const combinedList = useMemo(
    () => getCombinedThumbnailsList(thumbnails, effectiveGeneratingItems),
    [thumbnails, effectiveGeneratingItems]
  );
  const clickRankBorderById = useMemo(
    () => getClickRankBorderMap(combinedList),
    [combinedList]
  );

  return (
    <ThumbnailGrid
      thumbnails={thumbnails}
      generatingItems={effectiveGeneratingItems}
      isLoading={thumbnailsLoading}
      minSlots={12}
      showEmptySlots={showEmptySlots}
      clickRankBorderById={clickRankBorderById}
      breakpointCols={breakpointCols}
    />
  );
});

/**
 * StudioResults
 * Complete results panel composition with:
 * - Header with refresh, grid zoom slider, and sort
 * - Error display
 * - Optimized thumbnail grid
 * - Load more pagination
 */
export function StudioResults() {
  const [zoomLevel, , handleZoomChange] = useGridZoom("studio-create-zoom");
  const breakpointCols = useMemo(
    () => getMasonryBreakpointCols(zoomLevel),
    [zoomLevel]
  );
  return (
    <div data-tour="tour.studio.results.results.container.main">
      <StudioResultsHeader
        gridZoomLevel={zoomLevel}
        onGridZoomChange={handleZoomChange}
      />
      <StudioResultsError />
      <StudioResultsGrid breakpointCols={breakpointCols} />
      <StudioResultsLoadMore />
    </div>
  );
}
