"use client";

/**
 * PaletteCardManage Component
 *
 * Management-focused palette card built on PaletteThumbnailCard:
 * - Same visual styling and hover behavior as thumbnail-card
 * - Click opens view modal; hover shows Edit, Delete, Favorite, Toggle Public (owner)
 * - Default/Public badges
 *
 * @see palette-thumbnail-card.tsx (reusable base)
 */

import React, { memo, useCallback } from "react";
import { Sparkles, Droplets, Globe, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PaletteThumbnailCard } from "@/components/studio/palette-thumbnail-card";
import { cn } from "@/lib/utils";
import type { DbPalette } from "@/lib/types/database";

/**
 * Skeleton card for loading state (full-thumbnail shape, matches PaletteThumbnailCard)
 */
export function PaletteCardManageSkeleton() {
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

export interface PaletteCardManageProps {
  palette: DbPalette;
  isSelected?: boolean;
  isFavorite?: boolean;
  /** Called when card is clicked – e.g. open view modal */
  onView?: (palette: DbPalette) => void;
  /** Legacy: select by id (use onView for modal instead) */
  onSelect?: (id: string) => void;
  onEdit?: (palette: DbPalette) => void;
  onDelete?: (id: string) => void;
  onTogglePublic?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  showActions?: boolean;
  compact?: boolean;
  /** Current user ID for ownership (edit/delete/toggle public) */
  currentUserId?: string | null;
}

/**
 * Compact palette card for generator selection
 */
export const PaletteCardCompact = memo(function PaletteCardCompact({
  palette,
  isSelected,
  onSelect,
}: Pick<PaletteCardManageProps, "palette" | "isSelected" | "onSelect">) {
  const handleClick = useCallback(() => {
    onSelect?.(palette.id);
  }, [palette.id, onSelect]);

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md p-2 transition-all h-auto",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <div
        className={cn(
          "flex h-12 w-16 overflow-hidden rounded-md border-2 transition-all",
          isSelected
            ? "border-primary"
            : "border-border hover:border-primary/50"
        )}
      >
        {palette.colors.length > 0 ? (
          palette.colors.map((color, index) => (
            <div
              key={`${palette.id}-${index}`}
              className="flex-1"
              style={{ backgroundColor: color }}
            />
          ))
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <span className="max-w-16 truncate text-xs text-muted-foreground">
        {palette.name}
      </span>
    </Button>
  );
});

/**
 * Full palette card for management view – uses PaletteThumbnailCard
 */
export const PaletteCardManage = memo(function PaletteCardManage({
  palette,
  isSelected,
  isFavorite,
  onView,
  onSelect,
  onEdit,
  onDelete,
  onTogglePublic,
  onToggleFavorite,
  showActions = true,
  currentUserId,
}: PaletteCardManageProps) {
  const handleView = useCallback(() => {
    if (onView) {
      onView(palette);
    } else {
      onSelect?.(palette.id);
    }
  }, [palette, onView, onSelect]);

  const canShowOwnerActions = !palette.is_default && showActions;

  const topLeftBadges = palette.is_default ? (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Sparkles className="h-3 w-3" />
      Default
    </Badge>
  ) : undefined;

  // Public/private icon only (top-right), no lettering
  const topRightIcon = palette.is_public ? (
    <Globe className="h-4 w-4" />
  ) : (
    <Lock className="h-4 w-4" />
  );

  return (
    <div className={cn(isSelected && "ring-2 ring-primary ring-offset-2 rounded-lg")}>
      <PaletteThumbnailCard
        palette={palette}
        currentUserId={currentUserId}
        isFavorite={isFavorite}
        onView={handleView}
        onEdit={canShowOwnerActions ? onEdit : undefined}
        onDelete={canShowOwnerActions ? onDelete : undefined}
        onTogglePublic={canShowOwnerActions ? onTogglePublic : undefined}
        onToggleFavorite={showActions ? onToggleFavorite : undefined}
        isPublic={palette.is_public}
        topLeftBadges={topLeftBadges}
        topRightIcon={topRightIcon}
      />
    </div>
  );
});

export default PaletteCardManage;
