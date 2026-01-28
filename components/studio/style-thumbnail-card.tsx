"use client";

/**
 * StyleThumbnailCard Component
 * 
 * Optimized style thumbnail card matching ThumbnailCard design:
 * - React.memo for re-render optimization (rerender-memo)
 * - Lazy image loading
 * - Skeleton state for loading
 * - Hover effects: scale animation (105%), action buttons overlay
 * - Ownership-aware actions (edit/delete for owned styles)
 * - Click to view modal (larger image display)
 * 
 * @see thumbnail-card.tsx for the pattern this follows
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback, useState } from "react";
import { Sparkles, Pencil, Trash2, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PublicStyle, DbStyle } from "@/lib/types/database";

/**
 * Type guard to check if style is DbStyle
 */
function isDbStyle(style: PublicStyle | DbStyle): style is DbStyle {
  return 'user_id' in style || 'prompt' in style || 'reference_images' in style;
}

/**
 * Skeleton card for loading state
 */
export function StyleThumbnailCardSkeleton({ text }: { text?: string }) {
  return (
    <Card className="group relative overflow-hidden">
      <div className="relative aspect-video w-full bg-muted">
        <Skeleton className="h-full w-full" />
        {text && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="max-w-[80%] truncate text-xs text-muted-foreground">
              {text}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Empty card placeholder
 */
export function StyleThumbnailCardEmpty() {
  return (
    <Card className="aspect-video">
      <div className="flex h-full items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-muted" />
      </div>
    </Card>
  );
}

export interface StyleThumbnailCardProps {
  /** The style to display (PublicStyle for browse, DbStyle for my styles) */
  style: PublicStyle | DbStyle;
  /** Current user ID for ownership checks */
  currentUserId?: string;
  /** Whether this style is favorited */
  isFavorite?: boolean;
  /** Priority loading for above-the-fold items */
  priority?: boolean;
  /** Callback when card is clicked (for modal view) */
  onView?: (style: PublicStyle | DbStyle) => void;
  /** Callback when "Use Style" is clicked */
  onUseStyle?: (styleId: string) => void;
  /** Callback when edit is clicked (owner only) */
  onEdit?: (style: DbStyle) => void;
  /** Callback when delete is clicked (owner only) */
  onDelete?: (id: string) => void;
  /** Callback when toggle favorite is clicked */
  onToggleFavorite?: (id: string) => void;
}

/**
 * Action button with tooltip
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
            variant === "destructive" && "hover:bg-destructive/20 hover:text-destructive",
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
 * Memoized StyleThumbnailCard component
 * Matches ThumbnailCard's visual design and hover interactions
 */
export const StyleThumbnailCard = memo(function StyleThumbnailCard({
  style,
  currentUserId,
  isFavorite = false,
  priority = false,
  onView,
  onUseStyle,
  onEdit,
  onDelete,
  onToggleFavorite,
}: StyleThumbnailCardProps) {
  const { id, name, preview_thumbnail_url } = style;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Check if current user owns this style
  const userId = isDbStyle(style) ? style.user_id : null;
  const isOwner = currentUserId && userId && currentUserId === userId;

  // Memoize handlers to prevent re-renders
  const handleView = useCallback(() => {
    onView?.(style);
  }, [style, onView]);

  const handleUseStyle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onUseStyle?.(id);
    },
    [id, onUseStyle]
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isDbStyle(style)) {
        onEdit?.(style);
      }
    },
    [style, onEdit]
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

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <Card
      className={cn(
        "group relative aspect-video w-full cursor-pointer overflow-hidden p-0 transition-all",
        "hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
      )}
      onClick={handleView}
    >
      <div className="relative h-full w-full overflow-hidden bg-muted">
        {/* Image with scale animation on hover */}
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
          {!imageLoaded && !imageError && (
            <Skeleton className="absolute inset-0 h-full w-full" />
          )}
          
          {preview_thumbnail_url && !imageError ? (
            <img
              src={preview_thumbnail_url}
              alt={name}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className={cn(
                "h-full w-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <div className="text-xs text-muted-foreground">No preview</div>
            </div>
          )}
        </div>

        {/* Top overlay - Title - shown on hover */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex items-start justify-between p-2",
            "bg-gradient-to-b from-black/60 to-transparent",
            "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          )}
        >
          {/* Title */}
          <p className="max-w-[85%] truncate text-sm font-medium text-white drop-shadow-sm">
            {name}
          </p>
        </div>

        {/* Action bar - absolutely positioned at bottom, shown on hover */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-2",
            "bg-gradient-to-t from-black/60 via-black/40 to-transparent",
            "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          )}
        >
          {/* Use Style button - shown for all styles */}
          {onUseStyle && (
            <ActionButton
              icon={Sparkles}
              label="Use Style"
              onClick={handleUseStyle}
            />
          )}

          {/* Favorite button - shown if callback exists */}
          {onToggleFavorite && (
            <ActionButton
              icon={Heart}
              label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={handleToggleFavorite}
              active={isFavorite}
            />
          )}
          
          {/* Edit button - only shown if user owns the style */}
          {isOwner && onEdit && (
            <ActionButton
              icon={Pencil}
              label="Edit"
              onClick={handleEdit}
            />
          )}
          
          {/* Delete button - only shown if user owns the style */}
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

export default StyleThumbnailCard;
