"use client";

import React, { useCallback, memo, useState } from "react";
import { useStudio } from "./studio-provider";
import { ThumbnailGrid } from "./thumbnail-grid";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageModal } from "@/components/ui/modal";
import type { Thumbnail } from "@/lib/types/database";

/**
 * StudioResultsHeader
 * Header for results panel with refresh button
 */
export const StudioResultsHeader = memo(function StudioResultsHeader() {
  const { data, state } = useStudio();
  const { refreshThumbnails, thumbnailsLoading } = data;
  const { isGenerating } = state;

  const handleRefresh = useCallback(() => {
    refreshThumbnails();
  }, [refreshThumbnails]);

  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Live Results Feed</h2>
        <p className="text-sm text-muted-foreground">
          Your Generated Thumbnails
          {isGenerating && (
            <span className="ml-2 inline-flex items-center text-primary">
              <span className="mr-1 h-2 w-2 animate-pulse rounded-full bg-primary" />
              Generating...
            </span>
          )}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={thumbnailsLoading}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${thumbnailsLoading ? "animate-spin" : ""}`} />
        Refresh
      </Button>
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
  const { data } = useStudio();
  const { hasNextPage, fetchNextPage, isFetchingNextPage } = data;

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
            <RefreshCw className="h-4 w-4 animate-spin" />
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
 */
export const StudioResultsGrid = memo(function StudioResultsGrid() {
  const { data, actions } = useStudio();
  const { currentUserId, thumbnails, generatingItems, thumbnailsLoading } = data;
  const { 
    onFavoriteToggle, 
    onDeleteThumbnail, 
    onDownloadThumbnail, 
    onShareThumbnail,
    onCopyThumbnail,
    onEditThumbnail,
  } = actions;

  // State for image modal
  const [selectedThumbnail, setSelectedThumbnail] = useState<Thumbnail | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Handle thumbnail click to open image modal
  const handleThumbnailClick = useCallback((thumbnail: Thumbnail) => {
    setSelectedThumbnail(thumbnail);
    setIsImageModalOpen(true);
  }, []);

  // Handle modal close
  const handleModalClose = useCallback((open: boolean) => {
    if (!open) {
      setIsImageModalOpen(false);
      // Delay before clearing thumbnail to allow smooth exit animation
      setTimeout(() => {
        setSelectedThumbnail(null);
      }, 300);
    }
  }, []);

  return (
    <>
      <ThumbnailGrid
        thumbnails={thumbnails}
        generatingItems={generatingItems}
        isLoading={thumbnailsLoading}
        currentUserId={currentUserId}
        minSlots={12}
        showEmptySlots={thumbnails.length === 0 && generatingItems.size === 0}
        onFavoriteToggle={onFavoriteToggle}
        onDownload={onDownloadThumbnail}
        onShare={onShareThumbnail}
        onCopy={onCopyThumbnail}
        onEdit={onEditThumbnail}
        onDelete={onDeleteThumbnail}
        onClick={handleThumbnailClick}
      />
      
      {/* Image Modal for viewing full-size thumbnails */}
      {selectedThumbnail && (
        <ImageModal
          open={isImageModalOpen}
          onOpenChange={handleModalClose}
          src={selectedThumbnail.imageUrl}
          alt={selectedThumbnail.name}
          title={selectedThumbnail.name}
        />
      )}
    </>
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
