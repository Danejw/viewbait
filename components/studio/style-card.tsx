"use client";

/**
 * StyleCard Component
 * 
 * Versatile card for displaying styles in both contexts:
 * - Public browse view (with "Use Style" action)
 * - My Styles management view (with edit, delete, toggle public/favorite)
 * 
 * Optimized with:
 * - React.memo for re-render optimization (rerender-memo)
 * - Lazy image loading
 * - Skeleton state for loading
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback, useState } from "react";
import { Heart, Sparkles, ImageIcon, Edit2, Trash2, Globe, Lock, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PublicStyle, DbStyle } from "@/lib/types/database";

/**
 * Skeleton card for loading state
 */
export function StyleCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden">
      <div className="relative aspect-video w-full bg-muted">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="p-3">
        <Skeleton className="mb-2 h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </Card>
  );
}

/**
 * Empty card placeholder
 */
export function StyleCardEmpty() {
  return (
    <Card className="aspect-video">
      <div className="flex h-full items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-muted" />
      </div>
    </Card>
  );
}

/**
 * Props for StyleCard component
 * Supports both PublicStyle (browse) and DbStyle (my styles) types
 */
export interface StyleCardProps {
  /** The style to display (PublicStyle for browse, DbStyle for my styles) */
  style: PublicStyle | DbStyle;
  /** Whether this style is favorited (My Styles mode) */
  isFavorite?: boolean;
  /** Priority loading for above-the-fold items */
  priority?: boolean;
  /** Show action buttons (edit, delete, etc.) - My Styles mode */
  showActions?: boolean;
  /** Callback when "Use Style" is clicked (Browse mode) */
  onUseStyle?: (styleId: string) => void;
  /** Callback when card is clicked */
  onClick?: (style: PublicStyle | DbStyle) => void;
  /** Callback when edit is clicked (My Styles mode) */
  onEdit?: (style: DbStyle) => void;
  /** Callback when delete is clicked (My Styles mode) */
  onDelete?: (id: string) => void;
  /** Callback when toggle public is clicked (My Styles mode) */
  onTogglePublic?: (id: string) => void;
  /** Callback when toggle favorite is clicked (My Styles mode) */
  onToggleFavorite?: (id: string) => void;
}

/**
 * Type guard to check if style is DbStyle
 */
function isDbStyle(style: PublicStyle | DbStyle): style is DbStyle {
  return 'user_id' in style || 'prompt' in style || 'reference_images' in style;
}

/**
 * Memoized StyleCard component
 */
export const StyleCard = memo(function StyleCard({
  style,
  isFavorite = false,
  priority = false,
  showActions = false,
  onUseStyle,
  onClick,
  onEdit,
  onDelete,
  onTogglePublic,
  onToggleFavorite,
}: StyleCardProps) {
  const { id, name, description, preview_thumbnail_url } = style;
  const likeCount = 'like_count' in style ? style.like_count : undefined;
  const isPublic = isDbStyle(style) ? style.is_public : true;
  const isDefault = isDbStyle(style) ? style.is_default : false;
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleClick = useCallback(() => {
    onClick?.(style);
  }, [style, onClick]);

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

  const handleTogglePublic = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onTogglePublic?.(id);
    },
    [id, onTogglePublic]
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

  // Determine if we're in browse mode (has onUseStyle) or management mode (has onEdit)
  const isBrowseMode = !!onUseStyle && !showActions;

  return (
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden transition-all",
        "hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
      )}
      onClick={handleClick}
    >
      {/* Preview image */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
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
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}

        {/* Hover overlay */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/40",
            "opacity-0 transition-opacity group-hover:opacity-100"
          )}
        >
          {isBrowseMode && onUseStyle && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleUseStyle}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Use Style
            </Button>
          )}
        </div>

        {/* Like count badge (browse mode) */}
        {likeCount !== undefined && likeCount > 0 && !showActions && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
            <Heart className="h-3 w-3" />
            {likeCount}
          </div>
        )}

        {/* Public/Default badge (management mode) */}
        {showActions && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            {isDefault && (
              <span className="rounded bg-primary/90 px-1.5 py-0.5 text-xs text-primary-foreground">
                Default
              </span>
            )}
            {isPublic && !isDefault && (
              <span className="rounded bg-green-600/90 px-1.5 py-0.5 text-xs text-white">
                Public
              </span>
            )}
          </div>
        )}

        {/* Favorite button (management mode) */}
        {showActions && onToggleFavorite && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleFavorite}
            className={cn(
              "absolute right-2 top-2 h-8 w-8 bg-black/40 text-white hover:bg-black/60",
              isFavorite && "text-red-500"
            )}
          >
            <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
          </Button>
        )}
      </div>

      {/* Style info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{name}</h3>
            {description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          {/* Actions dropdown (management mode) */}
          {showActions && !isDefault && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 shrink-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onTogglePublic && (
                  <DropdownMenuItem onClick={handleTogglePublic}>
                    {isPublic ? (
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
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </Card>
  );
});

export default StyleCard;
