"use client";

/**
 * PaletteThumbnailCard Component
 *
 * Reusable palette thumbnail matching ThumbnailCard design:
 * - Tight container, aspect-consistent height for color strip
 * - Hover: scale 105%, ring, shadow; icon buttons overlay
 * - If user owns palette: also show Edit and Delete icon buttons
 * - Click opens view modal (larger palette display)
 *
 * Used in: Browse palettes tab, My Palettes view, and anywhere palette thumbnails are shown.
 *
 * @see thumbnail-card.tsx for the pattern this follows
 */

import React, { memo, useCallback } from "react";
import { Heart, Palette, Pencil, Trash2, Globe, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PublicPalette, DbPalette } from "@/lib/types/database";

/** Type that includes ownership for display logic */
type PaletteForCard = (PublicPalette | DbPalette) & { user_id?: string | null };

function hasUserId(p: PublicPalette | DbPalette): p is DbPalette {
  return "user_id" in p && p.user_id != null;
}

/**
 * Action button with tooltip (matches thumbnail-card pattern)
 */
function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  active = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: "default" | "destructive";
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          className={cn(
            "h-7 w-7 bg-muted/80 hover:bg-muted",
            variant === "destructive" &&
              "hover:bg-destructive/20 hover:text-destructive",
            active && "text-red-500"
          )}
        >
          <Icon className={cn("h-4 w-4", active && "fill-red-500")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Color swatch row – use h-full when filling the full thumbnail, or heightClass for fixed height
 */
export const PaletteColorStrip = memo(function PaletteColorStrip({
  colors,
  className,
  heightClass,
  fill = false,
  rounded = "rounded-lg",
}: {
  colors: string[];
  className?: string;
  heightClass?: string;
  /** When true, strip fills container (h-full w-full) */
  fill?: boolean;
  rounded?: string;
}) {
  if (colors.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          fill ? "h-full w-full" : heightClass ?? "h-16",
          rounded,
          className
        )}
      >
        No colors
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex w-full overflow-hidden",
        fill ? "h-full w-full" : heightClass ?? "h-16",
        rounded,
        className
      )}
    >
      {colors.map((color, index) => (
        <div
          key={`${color}-${index}`}
          className="flex-1 transition-all group-hover:flex-[1.02]"
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
});

export interface PaletteThumbnailCardProps {
  /** Palette data (PublicPalette or DbPalette) */
  palette: PublicPalette | DbPalette;
  /** Current user ID for ownership (show edit/delete if palette.user_id === currentUserId) */
  currentUserId?: string | null;
  /** Whether this palette is favorited */
  isFavorite?: boolean;
  /** Click to open view modal */
  onView?: (palette: PublicPalette | DbPalette) => void;
  /** "Use Palette" action (e.g. apply to generator) */
  onUsePalette?: (paletteId: string) => void;
  /** Edit action (owner only) */
  onEdit?: (palette: DbPalette) => void;
  /** Delete action (owner only) */
  onDelete?: (id: string) => void;
  /** Toggle favorite */
  onToggleFavorite?: (id: string) => void;
  /** Toggle public (owner only, manage view) */
  onTogglePublic?: (id: string) => void;
  /** Whether palette is public (for toggle icon state) */
  isPublic?: boolean;
  /** Optional badges to render top-left on hover (e.g. Default) */
  topLeftBadges?: React.ReactNode;
  /** Optional icon to render top-right on hover (e.g. Globe for public, Lock for private) */
  topRightIcon?: React.ReactNode;
}

/**
 * Memoized PaletteThumbnailCard – visual styling and behavior aligned with ThumbnailCard
 */
export const PaletteThumbnailCard = memo(function PaletteThumbnailCard({
  palette,
  currentUserId,
  isFavorite = false,
  onView,
  onUsePalette,
  onEdit,
  onDelete,
  onToggleFavorite,
  onTogglePublic,
  isPublic = false,
  topLeftBadges,
  topRightIcon,
}: PaletteThumbnailCardProps) {
  const { id, name, colors } = palette;
  const p = palette as PaletteForCard;
  const isOwner =
    !!currentUserId &&
    hasUserId(palette) &&
    p.user_id != null &&
    currentUserId === p.user_id;
  const likeCount =
    "like_count" in palette && typeof palette.like_count === "number"
      ? palette.like_count
      : undefined;

  const handleClick = useCallback(() => {
    onView?.(palette);
  }, [palette, onView]);

  const handleUsePalette = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onUsePalette?.(id);
    },
    [id, onUsePalette]
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasUserId(palette)) onEdit?.(palette);
    },
    [palette, onEdit]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(id);
    },
    [id, onDelete]
  );

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleFavorite?.(id);
    },
    [id, onToggleFavorite]
  );

  const handleTogglePublic = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onTogglePublic?.(id);
    },
    [id, onTogglePublic]
  );

  return (
    <Card
      className={cn(
        "group relative aspect-video w-full cursor-pointer overflow-hidden p-0 transition-all",
        "hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
      )}
      onClick={handleClick}
    >
      {/* Full-thumbnail area: colors fill the entire card */}
      <div className="relative h-full w-full overflow-hidden bg-muted">
        {/* Color strip fills whole thumbnail; scale on hover */}
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
          <PaletteColorStrip colors={colors} fill rounded="rounded-lg" />
        </div>

        {/* Top overlay – title + optional badges (left), public icon / like count (right); visible only on hover */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2",
            "bg-gradient-to-b from-black/60 to-transparent",
            "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {topLeftBadges}
            <p className="min-w-0 truncate text-sm font-medium text-white drop-shadow-sm">
              {name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {likeCount !== undefined && likeCount > 0 && (
              <span className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                <Heart className="h-3 w-3" />
                {likeCount}
              </span>
            )}
            {topRightIcon && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white [&>svg]:h-4 [&>svg]:w-4">
                {topRightIcon}
              </span>
            )}
          </div>
        </div>

        {/* Bottom overlay: action buttons only; visible only on hover */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-3",
            "bg-gradient-to-t from-black/70 via-black/40 to-transparent",
            "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          )}
        >
            {onUsePalette && (
              <ActionButton
                icon={Palette}
                label="Use Palette"
                onClick={handleUsePalette}
              />
            )}

            {onToggleFavorite && (
              <ActionButton
                icon={Heart}
                label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                onClick={handleToggleFavorite}
                active={isFavorite}
              />
            )}

            {isOwner && onEdit && (
              <ActionButton icon={Pencil} label="Edit" onClick={handleEdit} />
            )}

            {isOwner && onTogglePublic && (
              <ActionButton
                icon={isPublic ? Lock : Globe}
                label={isPublic ? "Make Private" : "Make Public"}
                onClick={handleTogglePublic}
              />
            )}

            {isOwner && onDelete && (
              <ActionButton
                icon={Trash2}
                label="Delete"
                onClick={handleDelete}
                variant="destructive"
              />
            )}
        </div>
      </div>
    </Card>
  );
});

export default PaletteThumbnailCard;
