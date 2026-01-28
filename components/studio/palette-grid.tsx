"use client";

/**
 * PaletteGrid Component
 * 
 * Optimized grid for displaying color palettes with:
 * - content-visibility: auto for rendering performance (rendering-content-visibility)
 * - Skeleton placeholders for loading state
 * - Memoized for re-render optimization
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { PaletteCard, PaletteCardSkeleton, PaletteCardEmpty } from "./palette-card";
import type { PublicPalette } from "@/lib/types/database";

const DEFAULT_MIN_SLOTS = 8;

export interface PaletteGridProps {
  /** Palettes to display */
  palettes: PublicPalette[];
  /** Minimum number of slots to show (fills with empty placeholders) */
  minSlots?: number;
  /** Show empty placeholders */
  showEmptySlots?: boolean;
  /** Grid columns class override */
  gridClassName?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Callbacks */
  onUsePalette?: (paletteId: string) => void;
  onClick?: (palette: PublicPalette) => void;
}

/**
 * CSS-in-JS for content-visibility optimization
 */
const gridItemStyles = {
  contentVisibility: "auto",
  containIntrinsicSize: "0 120px", // Approximate height for palette card
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
      // First 8 items (above the fold) don't need content-visibility
      className={cn(index < 8 && "![content-visibility:visible]")}
    >
      {children}
    </div>
  );
});

/**
 * Loading skeleton grid
 */
export function PaletteGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <PaletteCardSkeleton key={`skeleton-${i}`} />
      ))}
    </div>
  );
}

/**
 * Optimized PaletteGrid component
 */
export const PaletteGrid = memo(function PaletteGrid({
  palettes,
  minSlots = DEFAULT_MIN_SLOTS,
  showEmptySlots = false,
  gridClassName,
  isLoading = false,
  onUsePalette,
  onClick,
}: PaletteGridProps) {
  // Calculate empty slots
  const emptySlotCount = showEmptySlots
    ? Math.max(0, minSlots - palettes.length)
    : 0;

  // Memoize callbacks
  const handleUsePalette = useCallback(
    (paletteId: string) => onUsePalette?.(paletteId),
    [onUsePalette]
  );

  const handleClick = useCallback(
    (palette: PublicPalette) => onClick?.(palette),
    [onClick]
  );

  // Show loading skeleton
  if (isLoading) {
    return <PaletteGridSkeleton count={minSlots} />;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4",
        gridClassName
      )}
    >
      {/* Render palettes */}
      {palettes.map((palette, index) => (
        <GridItem key={palette.id} index={index}>
          <PaletteCard
            palette={palette}
            onUsePalette={handleUsePalette}
            onClick={handleClick}
          />
        </GridItem>
      ))}

      {/* Empty placeholders */}
      {Array.from({ length: emptySlotCount }).map((_, index) => (
        <GridItem key={`empty-${index}`} index={palettes.length + index}>
          <PaletteCardEmpty />
        </GridItem>
      ))}
    </div>
  );
});

export default PaletteGrid;
