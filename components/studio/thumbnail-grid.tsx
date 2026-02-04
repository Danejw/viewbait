"use client";

/**
 * ThumbnailGrid Component
 * 
 * Optimized grid for displaying many thumbnails with:
 * - content-visibility: auto for rendering performance (rendering-content-visibility)
 * - Virtualization for large lists
 * - Intersection observer for lazy loading
 * - Skeleton placeholders for empty slots
 * 
 * ThumbnailCard components handle their own actions via useThumbnailActions hook,
 * so no action callbacks need to be passed through this component.
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { gridItemAboveFoldClass, GRID_ABOVE_FOLD_DEFAULT } from "@/lib/utils/grid-visibility";
import { useEmptySlots } from "@/lib/hooks/useEmptySlots";
import { getCombinedThumbnailsList } from "@/lib/utils/studio-thumbnails";
import { ThumbnailCard, ThumbnailCardEmpty, ThumbnailCardSkeleton } from "./thumbnail-card";
import type { Thumbnail } from "@/lib/types/database";

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
}

/**
 * CSS-in-JS for content-visibility optimization
 * This improves rendering performance for off-screen items
 */
const gridItemStyles = {
  // content-visibility: auto skips rendering of off-screen items
  // contain-intrinsic-size ensures layout stability
  contentVisibility: "auto",
  containIntrinsicSize: "0 180px", // Approximate height for aspect-video
} as React.CSSProperties;

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
}: ThumbnailGridProps) {
  const combinedItems = useMemo(
    () => getCombinedThumbnailsList(thumbnails, generatingItems),
    [thumbnails, generatingItems]
  );

  const emptySlotCount = useEmptySlots(combinedItems.length, minSlots, showEmptySlots);

  // Show loading skeleton
  if (isLoading) {
    return <ThumbnailGridSkeleton count={minSlots} />;
  }

  return (
    <div
      className={cn(
        "grid w-full gap-3 p-1 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]",
        gridClassName
      )}
    >
      {/* Render combined items */}
      {combinedItems.map((thumbnail, index) => (
        <GridItem key={thumbnail.id} index={index}>
          <ThumbnailCard
            thumbnail={thumbnail}
            priority={index < 6}
            clickRankBorder={clickRankBorderById?.get(thumbnail.id)}
          />
        </GridItem>
      ))}

      {/* Empty placeholders */}
      {Array.from({ length: emptySlotCount }).map((_, index) => (
        <GridItem
          key={`empty-${index}`}
          index={combinedItems.length + index}
        >
          <ThumbnailCardEmpty />
        </GridItem>
      ))}
    </div>
  );
});

export default ThumbnailGrid;
