"use client";

/**
 * ThumbnailGrid Component
 *
 * Masonry layout (left-to-right, top-down) for mixed aspect ratios.
 * - content-visibility for above-the-fold optimization
 * - ThumbnailCard components handle their own actions via useThumbnailActions hook
 */

import React, { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { gridItemAboveFoldClass, GRID_ABOVE_FOLD_DEFAULT } from "@/lib/utils/grid-visibility";
import { useEmptySlots } from "@/lib/hooks/useEmptySlots";
import { getCombinedThumbnailsList } from "@/lib/utils/studio-thumbnails";
import { MasonryGrid, type MasonryGridBreakpoints } from "./masonry-grid";
import { ThumbnailCard, ThumbnailCardEmpty, ThumbnailCardSkeleton } from "./thumbnail-card";
import type { Thumbnail } from "@/lib/types/database";

/** Masonry breakpoints: ~200px min column width. */
const THUMBNAIL_MASONRY_BREAKPOINTS = {
  default: 6,
  1200: 6,
  1000: 5,
  800: 4,
  600: 3,
  400: 2,
  0: 1,
};

const DEFAULT_MIN_SLOTS = 12;

/** Border and/or shading for click-rank. Medals use className; rank 4+ use shadingClass only. */
export type ClickRankBorderStyle = {
  className?: string;
  style?: Record<string, string | number>;
  shadingClass?: string;
};

export interface ThumbnailGridProps {
  /** Thumbnails from database */
  thumbnails: Thumbnail[];
  /** Items currently being generated (skeleton state) */
  generatingItems?: Map<string, Thumbnail>;
  /** Minimum number of slots to show (fills with empty placeholders) */
  minSlots?: number;
  /** Show empty placeholders */
  showEmptySlots?: boolean;
  /** Grid columns class override */
  gridClassName?: string;
  /** Loading state for initial fetch */
  isLoading?: boolean;
  /** Optional map: thumbnail id → border class/style for click-rank display */
  clickRankBorderById?: Map<string, ClickRankBorderStyle>;
  /** Optional breakpoints (e.g. from grid zoom); when set, overrides default THUMBNAIL_MASONRY_BREAKPOINTS */
  breakpointCols?: MasonryGridBreakpoints;
}

/**
 * Content-visibility for off-screen items (card aspect-ratio drives height).
 */
const gridItemStyles = { contentVisibility: "auto" } as React.CSSProperties;

/**
 * Memoized grid item wrapper with content-visibility
 */
const GridItem = memo(function GridItem({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  return (
    <div
      style={gridItemStyles}
      className={cn(gridItemAboveFoldClass(index, GRID_ABOVE_FOLD_DEFAULT))}
    >
      {children}
    </div>
  );
});

/**
 * Loading skeleton grid
 */
export function ThumbnailGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid w-full gap-3 p-1 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
      {Array.from({ length: count }).map((_, i) => (
        <ThumbnailCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}

/**
 * Optimized ThumbnailGrid component
 * ThumbnailCard handles its own actions via useThumbnailActions hook
 */
export const ThumbnailGrid = memo(function ThumbnailGrid({
  thumbnails,
  generatingItems = new Map(),
  minSlots = DEFAULT_MIN_SLOTS,
  showEmptySlots = true,
  gridClassName,
  isLoading = false,
  clickRankBorderById,
  breakpointCols,
}: ThumbnailGridProps) {
  const combinedItems = useMemo(
    () => getCombinedThumbnailsList(thumbnails, generatingItems),
    [thumbnails, generatingItems]
  );

  const emptySlotCount = useEmptySlots(combinedItems.length, minSlots, showEmptySlots);

  const cols = breakpointCols ?? THUMBNAIL_MASONRY_BREAKPOINTS;

  // Show loading skeleton
  if (isLoading) {
    return <ThumbnailGridSkeleton count={minSlots} />;
  }

  return (
    <MasonryGrid
      data-tour="tour.studio.results.grid.thumbnails"
      breakpointCols={cols}
      gap={12}
      className={cn("w-full p-1", gridClassName)}
    >
      {combinedItems.map((thumbnail, index) => (
        <GridItem key={thumbnail.id} index={index}>
          <ThumbnailCard
            thumbnail={thumbnail}
            priority={index < 6}
            clickRankBorder={clickRankBorderById?.get(thumbnail.id)}
          />
        </GridItem>
      ))}
      {Array.from({ length: emptySlotCount }).map((_, index) => (
        <GridItem
          key={`empty-${index}`}
          index={combinedItems.length + index}
        >
          <ThumbnailCardEmpty />
        </GridItem>
      ))}
    </MasonryGrid>
  );
});

export default ThumbnailGrid;
