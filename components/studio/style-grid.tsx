"use client";

/**
 * StyleGrid Component
 * 
 * Optimized grid for displaying styles with:
 * - content-visibility: auto for rendering performance (rendering-content-visibility)
 * - Skeleton placeholders for loading state
 * - Memoized for re-render optimization
 * - Supports both PublicStyle (browse) and DbStyle (my styles) types
 * - Uses StyleThumbnailCard for consistent thumbnail design
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useEmptySlots } from "@/lib/hooks/useEmptySlots";
import { 
  StyleThumbnailCard, 
  StyleThumbnailCardSkeleton, 
  StyleThumbnailCardEmpty 
} from "./style-thumbnail-card";
import type { PublicStyle, DbStyle } from "@/lib/types/database";

const DEFAULT_MIN_SLOTS = 8;

export interface StyleGridProps {
  /** Styles to display (PublicStyle for browse, DbStyle for my styles) */
  styles: (PublicStyle | DbStyle)[];
  /** Current user ID for ownership checks */
  currentUserId?: string;
  /** Map of favorited style IDs */
  favoriteIds?: Set<string>;
  /** Minimum number of slots to show (fills with empty placeholders) */
  minSlots?: number;
  /** Show empty placeholders */
  showEmptySlots?: boolean;
  /** Grid columns class override */
  gridClassName?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Callbacks */
  onView?: (style: PublicStyle | DbStyle) => void;
  onUseStyle?: (styleId: string) => void;
  onEdit?: (style: DbStyle) => void;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onTogglePublic?: (id: string) => void;
}

/**
 * CSS-in-JS for content-visibility optimization
 */
const gridItemStyles = {
  contentVisibility: "auto",
  containIntrinsicSize: "0 240px", // Approximate height for style card
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
export function StyleGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StyleThumbnailCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}

/**
 * Optimized StyleGrid component
 */
export const StyleGrid = memo(function StyleGrid({
  styles,
  currentUserId,
  favoriteIds,
  minSlots = DEFAULT_MIN_SLOTS,
  showEmptySlots = false,
  gridClassName,
  isLoading = false,
  onView,
  onUseStyle,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTogglePublic,
}: StyleGridProps) {
  const emptySlotCount = useEmptySlots(styles.length, minSlots, showEmptySlots);

  // Memoize callbacks
  const handleView = useCallback(
    (style: PublicStyle | DbStyle) => onView?.(style),
    [onView]
  );

  const handleUseStyle = useCallback(
    (styleId: string) => onUseStyle?.(styleId),
    [onUseStyle]
  );

  const handleEdit = useCallback(
    (style: DbStyle) => onEdit?.(style),
    [onEdit]
  );

  const handleDelete = useCallback(
    (id: string) => onDelete?.(id),
    [onDelete]
  );

  const handleToggleFavorite = useCallback(
    (id: string) => onToggleFavorite?.(id),
    [onToggleFavorite]
  );

  const handleTogglePublic = useCallback(
    (id: string) => onTogglePublic?.(id),
    [onTogglePublic]
  );

  /** Type guard for DbStyle (has user_id / is_public) */
  const isDbStyle = (s: PublicStyle | DbStyle): s is DbStyle =>
    "user_id" in s && "is_public" in s;

  // Show loading skeleton
  if (isLoading) {
    return <StyleGridSkeleton count={minSlots} />;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4",
        gridClassName
      )}
    >
      {/* Render styles */}
      {styles.map((style, index) => (
        <GridItem key={style.id} index={index}>
          <StyleThumbnailCard
            style={style}
            currentUserId={currentUserId}
            isFavorite={favoriteIds?.has(style.id) ?? false}
            onView={handleView}
            onUseStyle={handleUseStyle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleFavorite={handleToggleFavorite}
            onTogglePublic={onTogglePublic}
            isPublic={isDbStyle(style) ? style.is_public : false}
            priority={index < 6}
          />
        </GridItem>
      ))}

      {/* Empty placeholders */}
      {Array.from({ length: emptySlotCount }).map((_, index) => (
        <GridItem key={`empty-${index}`} index={styles.length + index}>
          <StyleThumbnailCardEmpty />
        </GridItem>
      ))}
    </div>
  );
});

export default StyleGrid;
