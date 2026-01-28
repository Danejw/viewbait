"use client";

/**
 * PaletteCard Component
 * 
 * Optimized card for displaying color palettes with:
 * - React.memo for re-render optimization (rerender-memo)
 * - Color swatch display
 * - Skeleton state for loading
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback } from "react";
import { Heart, Palette } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PublicPalette } from "@/lib/types/database";

/**
 * Skeleton card for loading state
 */
export function PaletteCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden">
      <div className="flex h-16">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="flex-1" />
        ))}
      </div>
      <div className="p-3">
        <Skeleton className="h-4 w-3/4" />
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

/**
 * Color swatch component
 */
const ColorSwatch = memo(function ColorSwatch({
  color,
  isFirst,
  isLast,
}: {
  color: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 transition-all group-hover:flex-[1.2]",
        isFirst && "rounded-tl-lg",
        isLast && "rounded-tr-lg"
      )}
      style={{ backgroundColor: color }}
      title={color}
    />
  );
});

export interface PaletteCardProps {
  palette: PublicPalette;
  onUsePalette?: (paletteId: string) => void;
  onClick?: (palette: PublicPalette) => void;
}

/**
 * Memoized PaletteCard component
 */
export const PaletteCard = memo(function PaletteCard({
  palette,
  onUsePalette,
  onClick,
}: PaletteCardProps) {
  const { id, name, colors, like_count } = palette;

  const handleClick = useCallback(() => {
    onClick?.(palette);
  }, [palette, onClick]);

  const handleUsePalette = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onUsePalette?.(id);
    },
    [id, onUsePalette]
  );

  return (
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden transition-all",
        "hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
      )}
      onClick={handleClick}
    >
      {/* Color swatches */}
      <div className="relative flex h-16">
        {colors.map((color, index) => (
          <ColorSwatch
            key={`${id}-${index}`}
            color={color}
            isFirst={index === 0}
            isLast={index === colors.length - 1}
          />
        ))}

        {/* Hover overlay with Use Palette button */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/40",
            "opacity-0 transition-opacity group-hover:opacity-100"
          )}
        >
          {onUsePalette && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleUsePalette}
              className="gap-1.5"
            >
              <Palette className="h-3.5 w-3.5" />
              Use Palette
            </Button>
          )}
        </div>

        {/* Like count badge */}
        {like_count !== undefined && like_count > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
            <Heart className="h-3 w-3" />
            {like_count}
          </div>
        )}
      </div>

      {/* Palette info */}
      <div className="flex items-center justify-between p-3">
        <h3 className="truncate text-sm font-medium">{name}</h3>
        <span className="text-xs text-muted-foreground">
          {colors.length} colors
        </span>
      </div>
    </Card>
  );
});

export default PaletteCard;
