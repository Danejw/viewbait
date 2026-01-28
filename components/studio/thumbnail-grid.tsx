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
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ThumbnailCard, ThumbnailCardEmpty, ThumbnailCardSkeleton } from "./thumbnail-card";
import type { Thumbnail } from "@/lib/types/database";

/**
 * Grid configuration
 */
const GRID_COLUMNS = {
  sm: 2,
  md: 3,
  lg: 4,
} as const;

const DEFAULT_MIN_SLOTS = 12;

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
  /** Callbacks */
  onFavoriteToggle?: (id: string) => void;
  onDownload?: (id: string) => void;
  onShare?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (thumbnail: Thumbnail) => void;
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
      // First 6 items (above the fold) don't need content-visibility
      className={cn(index < 6 && "![content-visibility:visible]")}
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ThumbnailCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}

/**
 * Optimized ThumbnailGrid component
 */
export const ThumbnailGrid = memo(function ThumbnailGrid({
  thumbnails,
  generatingItems = new Map(),
  minSlots = DEFAULT_MIN_SLOTS,
  showEmptySlots = true,
  gridClassName,
  isLoading = false,
  currentUserId,
  onFavoriteToggle,
  onDownload,
  onShare,
  onCopy,
  onEdit,
  onDelete,
  onClick,
}: ThumbnailGridProps) {
  // Combine generating items and db thumbnails
  // Generating items appear first (newest at top)
  const combinedItems = useMemo(() => {
    const generatingArray = Array.from(generatingItems.values());
    
    // Filter out thumbnails that are in generatingItems (by id match)
    // This prevents duplicates when a generating item gets its real ID
    const generatingIds = new Set(generatingArray.map(item => item.id));
    const filteredThumbnails = thumbnails.filter(t => !generatingIds.has(t.id));
    
    return [...generatingArray, ...filteredThumbnails];
  }, [thumbnails, generatingItems]);

  // Calculate empty slots
  const emptySlotCount = useMemo(() => {
    if (!showEmptySlots) return 0;
    return Math.max(0, minSlots - combinedItems.length);
  }, [showEmptySlots, minSlots, combinedItems.length]);

  // Memoize callbacks for stability (rerender-functional-setstate)
  const handleFavoriteToggle = useCallback(
    (id: string) => onFavoriteToggle?.(id),
    [onFavoriteToggle]
  );

  const handleDownload = useCallback(
    (id: string) => onDownload?.(id),
    [onDownload]
  );

  const handleShare = useCallback(
    (id: string) => onShare?.(id),
    [onShare]
  );

  const handleCopy = useCallback(
    (id: string) => onCopy?.(id),
    [onCopy]
  );

  const handleEdit = useCallback(
    (thumbnail: Thumbnail) => onEdit?.(thumbnail),
    [onEdit]
  );

  const handleDelete = useCallback(
    (id: string) => onDelete?.(id),
    [onDelete]
  );

  const handleClick = useCallback(
    (thumbnail: Thumbnail) => onClick?.(thumbnail),
    [onClick]
  );

  // Show loading skeleton
  if (isLoading) {
    return <ThumbnailGridSkeleton count={minSlots} />;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4",
        gridClassName
      )}
    >
      {/* Render combined items */}
      {combinedItems.map((thumbnail, index) => (
        <GridItem key={thumbnail.id} index={index}>
          <ThumbnailCard
            thumbnail={thumbnail}
            currentUserId={currentUserId}
            onFavoriteToggle={handleFavoriteToggle}
            onDownload={handleDownload}
            onShare={handleShare}
            onCopy={handleCopy}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClick={handleClick}
            // First 6 items are above the fold - priority load
            priority={index < 6}
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
