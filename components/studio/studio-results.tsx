"use client";

import React, { useCallback, memo } from "react";
import { useStudio } from "./studio-provider";
import { ThumbnailGrid } from "./thumbnail-grid";
import { Button } from "@/components/ui/button";
import { ProjectSelector } from "@/components/studio/project-selector";
import { AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";

/**
 * StudioResultsHeader
 * Header for results panel with project selector and refresh button.
 * Project selection lives here in the generator tab (uses reusable ProjectSelector).
 */
export const StudioResultsHeader = memo(function StudioResultsHeader() {
  const { data, state } = useStudio();
  const { refreshThumbnails, thumbnailsLoading } = data;
  const { isGenerating } = state;

  const handleRefresh = useCallback(() => {
    refreshThumbnails();
  }, [refreshThumbnails]);

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-left">
        <h2 className="mb-2 text-2xl font-bold">Create Thumbnails</h2>
        <Button
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
      <div className="flex items-center gap-2">
        <ProjectSelector variant="inline" label="Project" />
        {isGenerating && (
          <span className="inline-flex items-center text-sm text-primary">
            <span className="mr-1 h-2 w-2 animate-pulse rounded-full bg-primary" />
            Generating...
          </span>
        )}
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
    <div className="mt-6 flex justify-center">
      <Button
        variant="outline"
        onClick={() => fetchNextPage()}
        disabled={isFetchingNextPage}
        className="gap-2"
      >
        {isFetchingNextPage ? (
          <>
            <ViewBaitLogo className="h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            Load More
          </>
        )}
      </Button>
    </div>
  );
});

/**
 * StudioResultsGrid
 * Optimized grid using ThumbnailGrid component
 * ThumbnailCard handles its own actions via useThumbnailActions hook
 * ImageModal is rendered globally in StudioProvider
 */
export const StudioResultsGrid = memo(function StudioResultsGrid() {
  const { data: studioData } = useStudio();
  const { thumbnails, generatingItems, thumbnailsLoading } = studioData;

  return (
    <ThumbnailGrid
      thumbnails={thumbnails}
      generatingItems={generatingItems}
      isLoading={thumbnailsLoading}
      minSlots={12}
      showEmptySlots={thumbnails.length === 0 && generatingItems.size === 0}
    />
  );
});

/**
 * StudioResults
 * Complete results panel composition with:
 * - Header with refresh
 * - Error display
 * - Optimized thumbnail grid
 * - Load more pagination
 */
export function StudioResults() {
  return (
    <div>
      <StudioResultsHeader />
      <StudioResultsError />
      <StudioResultsGrid />
      <StudioResultsLoadMore />
    </div>
  );
}
