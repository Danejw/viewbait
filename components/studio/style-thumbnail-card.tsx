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
 * - Drag-and-drop support for dropping into sidebar settings
 * 
 * @see thumbnail-card.tsx for the pattern this follows
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Sparkles, Pencil, Trash2, Heart, Download, Globe, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { blobToJpeg } from "@/lib/utils/blobToJpeg";
import { ActionBarIcon, ActionButton } from "@/components/studio/action-bar-icon";
import type { PublicStyle, DbStyle } from "@/lib/types/database";
import type { DragData } from "./studio-dnd-context";

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
  /** Callback when toggle public/private is clicked (owner only) */
  onTogglePublic?: (id: string) => void;
  /** Whether this style is public (for icon and toggle label; Lock = private, Globe = public) */
  isPublic?: boolean;
  /** Optional badges to render top-left on hover (e.g. Default) */
  topLeftBadges?: React.ReactNode;
  /** Optional icon to render top-right on hover (e.g. Globe for public, Lock for private) */
  topRightIcon?: React.ReactNode;
  /** Whether drag-and-drop is enabled (default: true) */
  draggable?: boolean;
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
  onTogglePublic,
  isPublic = false,
  topLeftBadges,
  topRightIcon,
  draggable = true,
}: StyleThumbnailCardProps) {
  const { id, name, preview_thumbnail_url } = style;
  const displayTopRightIcon = topRightIcon ?? (isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Setup draggable - pass style data for drop handling
  const dragData: DragData = {
    type: "style",
    id,
    item: style,
  };
  
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `style-${id}`,
    data: dragData,
    disabled: !draggable,
  });

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

  const handleTogglePublic = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onTogglePublic?.(id);
    },
    [id, onTogglePublic]
  );

  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!preview_thumbnail_url) return;
      const baseName = name || "style";
      try {
        const res = await fetch(preview_thumbnail_url, { mode: "cors" });
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
        const blob = await res.blob();
        let downloadBlob: Blob;
        let filename: string;
        try {
          downloadBlob = await blobToJpeg(blob);
          filename = `${baseName}.jpg`;
        } catch {
          downloadBlob = blob;
          const ext = blob.type?.includes("jpeg") || blob.type?.includes("jpg") ? "jpg" : "png";
          filename = `${baseName}.${ext}`;
        }
        const objectUrl = URL.createObjectURL(downloadBlob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        console.error("Style image download failed:", err);
        const link = document.createElement("a");
        link.href = preview_thumbnail_url;
        link.download = `${baseName}.jpg`;
        link.click();
      }
    },
    [preview_thumbnail_url, name]
  );

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <Card
      data-testid={`style-option-${id}`}
      ref={setNodeRef}
      className={cn(
        "group relative aspect-video w-full cursor-pointer overflow-hidden p-0 transition-all",
        "hover:ring-2 hover:ring-primary/50 hover:shadow-lg",
        isDragging && "opacity-50 ring-2 ring-primary cursor-grabbing",
        draggable && !isDragging && "cursor-grab"
      )}
      onClick={handleView}
      {...listeners}
      {...attributes}
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

        {/* Top overlay – title + badges/icon; smooth in/out from top */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2",
            "bg-gradient-to-b from-black/60 to-transparent",
            "opacity-0 -translate-y-2 transition-all duration-200 ease-out",
            "group-hover:opacity-100 group-hover:translate-y-0"
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {topLeftBadges}
            <p className="min-w-0 truncate text-sm font-medium text-white drop-shadow-sm">
              {name}
            </p>
          </div>
          {(topRightIcon != null || (isOwner && onTogglePublic != null)) && (
            <div className="flex shrink-0 items-center justify-center rounded-full bg-black/60 text-white [&>svg]:h-4 [&>svg]:w-4 h-7 w-7">
              {displayTopRightIcon}
            </div>
          )}
        </div>

        {/* Action bar - absolutely positioned at bottom; smooth in/out (opacity + slide) */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-2",
            "bg-gradient-to-t from-black/60 via-black/40 to-transparent",
            "opacity-0 translate-y-2 transition-all duration-200 ease-out",
            "group-hover:opacity-100 group-hover:translate-y-0"
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

          {/* Download button - only shown if user owns the style and has a preview image */}
          {isOwner && preview_thumbnail_url && (
            <ActionButton
              icon={Download}
              label="Download"
              onClick={handleDownload}
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

          {/* Toggle public/private - only shown if user owns the style */}
          {isOwner && onTogglePublic && (
            <ActionButton
              icon={isPublic ? Globe : Lock}
              label={isPublic ? "Make Private" : "Make Public"}
              onClick={handleTogglePublic}
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
