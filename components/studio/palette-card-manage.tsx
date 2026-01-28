"use client";

/**
 * PaletteCardManage Component
 * 
 * Management-focused card for displaying color palettes with:
 * - Color swatches display
 * - Edit, delete, toggle public actions
 * - Favorite toggle
 * - Default/Public badges
 * 
 * Optimized with:
 * - React.memo for re-render optimization
 * - useCallback for handlers
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback } from "react";
import {
  Heart,
  Sparkles,
  Droplets,
  Edit2,
  Trash2,
  Globe,
  Lock,
  MoreHorizontal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DbPalette } from "@/lib/types/database";

/**
 * Skeleton card for loading state
 */
export function PaletteCardManageSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex h-20">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="flex-1" />
        ))}
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    </Card>
  );
}

/**
 * Color swatch component with hover effect
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
        "flex-1 transition-all duration-200 group-hover:flex-[1.15]",
        isFirst && "rounded-tl-lg",
        isLast && "rounded-tr-lg"
      )}
      style={{ backgroundColor: color }}
      title={color}
    />
  );
});

export interface PaletteCardManageProps {
  palette: DbPalette;
  isSelected?: boolean;
  isFavorite?: boolean;
  onSelect?: (id: string) => void;
  onEdit?: (palette: DbPalette) => void;
  onDelete?: (id: string) => void;
  onTogglePublic?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  showActions?: boolean;
  compact?: boolean;
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
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md p-2 transition-all",
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
    </button>
  );
});

/**
 * Full palette card for management view
 */
export const PaletteCardManage = memo(function PaletteCardManage({
  palette,
  isSelected,
  isFavorite,
  onSelect,
  onEdit,
  onDelete,
  onTogglePublic,
  onToggleFavorite,
  showActions = true,
}: PaletteCardManageProps) {
  const handleSelect = useCallback(() => {
    onSelect?.(palette.id);
  }, [palette.id, onSelect]);

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit?.(palette);
    },
    [palette, onEdit]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(palette.id);
    },
    [palette.id, onDelete]
  );

  const handleTogglePublic = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onTogglePublic?.(palette.id);
    },
    [palette.id, onTogglePublic]
  );

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleFavorite?.(palette.id);
    },
    [palette.id, onToggleFavorite]
  );

  // Users cannot edit default palettes
  const canEdit = !palette.is_default && showActions;
  const canDelete = !palette.is_default && showActions;
  const canTogglePublic = !palette.is_default && showActions;

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden transition-all",
        "hover:ring-2 hover:ring-primary/50 hover:shadow-lg",
        isSelected && "ring-2 ring-primary shadow-lg"
      )}
      onClick={handleSelect}
    >
      {/* Color Swatches */}
      <div className="relative flex h-20 overflow-hidden">
        {palette.colors.length > 0 ? (
          palette.colors.map((color, index) => (
            <ColorSwatch
              key={`${palette.id}-${index}`}
              color={color}
              isFirst={index === 0}
              isLast={index === palette.colors.length - 1}
            />
          ))
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Droplets className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute left-2 top-2 flex gap-1">
          {palette.is_default && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Sparkles className="h-3 w-3" />
              Default
            </Badge>
          )}
          {palette.is_public && !palette.is_default && (
            <Badge variant="outline" className="gap-1 bg-background/80 text-xs">
              <Globe className="h-3 w-3" />
              Public
            </Badge>
          )}
        </div>

        {/* Favorite button overlay */}
        {showActions && onToggleFavorite && (
          <button
            type="button"
            onClick={handleToggleFavorite}
            className={cn(
              "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full transition-all",
              "bg-background/80 backdrop-blur-sm",
              "opacity-0 group-hover:opacity-100",
              isFavorite && "opacity-100"
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                isFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground hover:text-red-500"
              )}
            />
          </button>
        )}
      </div>

      <div className="p-4">
        {/* Header with name and actions */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Droplets className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="truncate font-medium">{palette.name}</h3>
          </div>

          {(canEdit || canDelete || canTogglePublic) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canTogglePublic && (
                  <DropdownMenuItem onClick={handleTogglePublic}>
                    {palette.is_public ? (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Make Private
                      </>
                    ) : (
                      <>
                        <Globe className="mr-2 h-4 w-4" />
                        Make Public
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {(canEdit || canTogglePublic) && canDelete && (
                  <DropdownMenuSeparator />
                )}
                {canDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Color count and hex codes preview */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{palette.colors.length} colors</span>
          <span className="max-w-[120px] truncate">
            {palette.colors.slice(0, 3).join(", ")}
            {palette.colors.length > 3 && "..."}
          </span>
        </div>
      </div>
    </Card>
  );
});

export default PaletteCardManage;
