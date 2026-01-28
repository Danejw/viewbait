"use client";

/**
 * StyleGrid Component
 * 
 * Optimized grid for displaying styles with:
 * - content-visibility: auto for rendering performance (rendering-content-visibility)
 * - Skeleton placeholders for loading state
 * - Memoized for re-render optimization
 * - Supports both PublicStyle (browse) and DbStyle (my styles) types
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { StyleCard, StyleCardSkeleton, StyleCardEmpty } from "./style-card";
import type { PublicStyle, DbStyle } from "@/lib/types/database";

const DEFAULT_MIN_SLOTS = 8;

export interface StyleGridProps {
  /** Styles to display (PublicStyle for browse, DbStyle for my styles) */
  styles: (PublicStyle | DbStyle)[];
  /** Minimum number of slots to show (fills with empty placeholders) */
  minSlots?: number;
  /** Show empty placeholders */
  showEmptySlots?: boolean;
  /** Grid columns class override */
  gridClassName?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Callbacks for browse mode */
  onUseStyle?: (styleId: string) => void;
  onClick?: (style: PublicStyle | DbStyle) => void;
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
        <StyleCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}

/**
 * Optimized StyleGrid component
 */
export const StyleGrid = memo(function StyleGrid({
  styles,
  minSlots = DEFAULT_MIN_SLOTS,
  showEmptySlots = false,
  gridClassName,
  isLoading = false,
  onUseStyle,
  onClick,
}: StyleGridProps) {
  // Calculate empty slots
  const emptySlotCount = showEmptySlots
    ? Math.max(0, minSlots - styles.length)
    : 0;

  // Memoize callbacks
  const handleUseStyle = useCallback(
    (styleId: string) => onUseStyle?.(styleId),
    [onUseStyle]
  );

  const handleClick = useCallback(
    (style: PublicStyle | DbStyle) => onClick?.(style),
    [onClick]
  );

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
          <StyleCard
            style={style}
            onUseStyle={handleUseStyle}
            onClick={handleClick}
            // First 6 items are above the fold - priority load
            priority={index < 6}
          />
        </GridItem>
      ))}

      {/* Empty placeholders */}
      {Array.from({ length: emptySlotCount }).map((_, index) => (
        <GridItem key={`empty-${index}`} index={styles.length + index}>
          <StyleCardEmpty />
        </GridItem>
      ))}
    </div>
  );
});

export default StyleGrid;
