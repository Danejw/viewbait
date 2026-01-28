"use client";

/**
 * ThumbnailCard Component
 * 
 * Optimized thumbnail card with:
 * - React.memo for re-render optimization (rerender-memo)
 * - Lazy image loading with intersection observer
 * - Skeleton state for generating items
 * - Progressive image loading (400w -> 800w -> full)
 * - Hover effects: scale animation, title/resolution overlay, action bar
 * - Auto-wired actions via useThumbnailActions hook (no prop drilling)
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback, useMemo, useState } from "react";
import { Heart, Download, Share2, Copy, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import { useThumbnailActions } from "@/components/studio/studio-provider";
import type { Thumbnail } from "@/lib/types/database";

/**
 * Resolution badge display - positioned top-right, shown on hover
 */
function ResolutionBadge({ 
  resolution, 
  className 
}: { 
  resolution?: string | null;
  className?: string;
}) {
  if (!resolution) return null;
  
  const badgeColors: Record<string, string> = {
    "1K": "bg-zinc-600",
    "2K": "bg-blue-600",
    "4K": "bg-purple-600",
  };
  
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium text-white shadow-sm",
        badgeColors[resolution] || "bg-zinc-600",
        className
      )}
    >
      {resolution}
    </span>
  );
}

/**
 * Skeleton card for generating state
 */
export function ThumbnailCardSkeleton({ text }: { text?: string }) {
  return (
    <Card className="group relative overflow-hidden">
      <div className="relative aspect-video w-full bg-muted">
        <Skeleton className="h-full w-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          {text && (
            <p className="max-w-[80%] truncate text-xs text-muted-foreground">
              {text}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Empty card placeholder
 */
export function ThumbnailCardEmpty() {
  return (
    <Card className="aspect-video">
      <div className="flex h-full items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-muted" />
      </div>
    </Card>
  );
}

export interface ThumbnailCardProps {
  thumbnail: Thumbnail;
  priority?: boolean;
}

/**
 * Progressive image component with lazy loading and scale animation
 */
const ProgressiveImage = memo(function ProgressiveImage({
  src,
  src400w,
  src800w,
  alt,
  priority = false,
  className,
}: {
  src: string;
  src400w?: string | null;
  src800w?: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const [ref, isIntersecting] = useIntersectionObserver({
    rootMargin: "200px",
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);

  const imageSrc = useMemo(() => {
    if (priority) {
      return src800w || src;
    }
    if (isIntersecting) {
      return src400w || src800w || src;
    }
    return null;
  }, [priority, isIntersecting, src, src400w, src800w]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    if (currentSrc === src400w && (src800w || src)) {
      setCurrentSrc(src800w || src);
    }
  }, [currentSrc, src400w, src800w, src]);

  React.useEffect(() => {
    if (imageSrc && !currentSrc) {
      setCurrentSrc(imageSrc);
    }
  }, [imageSrc, currentSrc]);

  return (
    <div ref={ref} className={cn("relative h-full w-full", className)}>
      {!isLoaded && (
        <Skeleton className="absolute inset-0 h-full w-full" />
      )}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          onLoad={handleLoad}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className={cn(
            "h-full w-full object-cover transition-all duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
});

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
 * Memoized ThumbnailCard component
 * Uses useThumbnailActions hook to get all actions from context
 * Only re-renders when thumbnail data changes
 */
export const ThumbnailCard = memo(function ThumbnailCard({
  thumbnail,
  priority = false,
}: ThumbnailCardProps) {
  // Get all actions and currentUserId from context
  const {
    currentUserId,
    onFavoriteToggle,
    onDownload,
    onShare,
    onCopy,
    onEdit,
    onDelete,
    onView,
  } = useThumbnailActions();

  const {
    id,
    name,
    imageUrl,
    thumbnail400wUrl,
    thumbnail800wUrl,
    isFavorite,
    generating,
    resolution,
    authorId,
  } = thumbnail;

  // Check if current user owns this thumbnail
  const isOwner = currentUserId && authorId && currentUserId === authorId;

  // Show skeleton for generating items
  if (generating) {
    return <ThumbnailCardSkeleton text={name} />;
  }

  // Memoize handlers to prevent re-renders
  const handleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFavoriteToggle(id);
    },
    [id, onFavoriteToggle]
  );

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDownload(id);
    },
    [id, onDownload]
  );

  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onShare(id);
    },
    [id, onShare]
  );

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCopy(id);
    },
    [id, onCopy]
  );

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit(thumbnail);
    },
    [thumbnail, onEdit]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(id);
    },
    [id, onDelete]
  );

  const handleClick = useCallback(() => {
    onView(thumbnail);
  }, [thumbnail, onView]);

  return (
    <Card
      className={cn(
        "group relative aspect-video w-full cursor-pointer overflow-hidden p-0 transition-all",
        "hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
      )}
      onClick={handleClick}
    >
      <div className="relative h-full w-full overflow-hidden bg-muted">
        {/* Image with scale animation on hover */}
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
          <ProgressiveImage
            src={imageUrl}
            src400w={thumbnail400wUrl}
            src800w={thumbnail800wUrl}
            alt={name}
            priority={priority}
          />
        </div>

        {/* Top overlay - Title (left) and Resolution (right) - shown on hover */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex items-start justify-between p-2",
            "bg-gradient-to-b from-black/60 to-transparent",
            "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          )}
        >
          {/* Title */}
          <p className="max-w-[70%] truncate text-sm font-medium text-white drop-shadow-sm">
            {name}
          </p>
          
          {/* Resolution badge */}
          <ResolutionBadge resolution={resolution} />
        </div>

        {/* Action bar - absolutely positioned at bottom, shown on hover */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-2",
            "bg-gradient-to-t from-black/60 via-black/40 to-transparent",
            "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          )}
        >
          <ActionButton
            icon={Heart}
            label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            onClick={handleFavorite}
            active={isFavorite}
          />
          
          <ActionButton
            icon={Download}
            label="Download"
            onClick={handleDownload}
          />
          
          <ActionButton
            icon={Share2}
            label="Share"
            onClick={handleShare}
          />
          
          <ActionButton
            icon={Copy}
            label="Copy link"
            onClick={handleCopy}
          />
          
          {/* Edit button - only shown if user owns the thumbnail */}
          {isOwner && (
            <ActionButton
              icon={Pencil}
              label="Edit"
              onClick={handleEdit}
            />
          )}
          
          {/* Delete button - only shown if user owns the thumbnail */}
          {isOwner && (
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

export default ThumbnailCard;
