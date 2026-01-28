"use client";

/**
 * PaletteCard Component
 *
 * Browse-focused palette card built on PaletteThumbnailCard:
 * - Same visual styling and hover behavior as thumbnail-card
 * - Click opens view modal (via context or onClick prop)
 * - Use Palette and optional Favorite actions
 *
 * @see palette-thumbnail-card.tsx (reusable base)
 * @see thumbnail-card.tsx for design reference
 */

import React, { memo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaletteThumbnailCard } from "@/components/studio/palette-thumbnail-card";
import type { PublicPalette } from "@/lib/types/database";

/**
 * Skeleton card for loading state (full-thumbnail shape, matches PaletteThumbnailCard)
 */
export function PaletteCardSkeleton() {
  return (
    <Card className="aspect-video w-full overflow-hidden p-0">
      <div className="flex h-full w-full">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 rounded-none" />
        ))}
      </div>
    </Card>
  );
}

/**
 * Empty card placeholder
 */
export function PaletteCardEmpty() {
  return (
    <Card className="h-24">
      <div className="flex h-full items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-muted" />
      </div>
    </Card>
  );
}

export interface PaletteCardProps {
  palette: PublicPalette;
  onUsePalette?: (paletteId: string) => void;
  onClick?: (palette: PublicPalette) => void;
  /** When in browse tab, optional favorite state/callback from parent */
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

/**
 * Memoized PaletteCard – uses PaletteThumbnailCard with browse callbacks.
 * Parent should pass onClick to open view modal (e.g. from studio context).
 */
export const PaletteCard = memo(function PaletteCard({
  palette,
  onUsePalette,
  onClick,
  isFavorite = false,
  onToggleFavorite,
}: PaletteCardProps) {
  const handleView = useCallback(() => {
    onClick?.(palette);
  }, [palette, onClick]);

  return (
    <PaletteThumbnailCard
      palette={palette}
      isFavorite={isFavorite}
      onView={handleView}
      onUsePalette={onUsePalette}
      onToggleFavorite={onToggleFavorite}
    />
  );
});

export default PaletteCard;
