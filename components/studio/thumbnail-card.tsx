"use client";

/**
 * ThumbnailCard Component
 * 
 * Optimized thumbnail card with:
 * - React.memo for re-render optimization (rerender-memo)
 * - Lazy image loading with intersection observer
 * - Skeleton state for generating items
 * - Progressive image loading (400w -> 800w -> full)
 * - Hover effects: scale animation, title/resolution overlay
 * - Action bar in a pop-up above the thumbnail on hover (HoverCard) so icons
 *   are never clipped by the card bounds and remain fully visible/clickable
 * - Auto-wired actions via useThumbnailActions hook (no prop drilling)
 * - Drag-and-drop support for dropping into style references
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Heart, Download, Share2, Copy, Pencil, Trash2, FolderPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { CRTLoadingEffect } from "@/components/ui/crt-loading-effect";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import { useWatermarkedImage } from "@/lib/hooks/useWatermarkedImage";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useThumbnailActions } from "@/components/studio/studio-provider";
import type { Thumbnail } from "@/lib/types/database";
import type { DragData } from "./studio-dnd-context";

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
 * Skeleton card for loading state (initial fetch, empty slots).
 * Uses shimmer animation from Skeleton component.
 */
export function ThumbnailCardSkeleton({ text }: { text?: string }) {
  return (
    <Card className="group relative overflow-hidden p-0">
      <div className="relative aspect-video w-full">
        <Skeleton className="h-full w-full rounded-lg" />
        {text && (
          <div className="absolute inset-x-0 bottom-0 p-2">
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Card shown while a thumbnail is being generated.
 * Uses CRT loading effect (retro static/noise) for brand-consistent loading state.
 */
function ThumbnailCardGenerating({ text }: { text?: string }) {
  return (
    <Card className="group relative overflow-hidden p-0">
      <div className="relative aspect-video w-full">
        <CRTLoadingEffect className="absolute inset-0 h-full w-full !aspect-auto rounded-lg" />
        {text && (
          <div className="absolute inset-x-0 bottom-0 z-[1] p-2">
            <p className="truncate text-xs text-muted-foreground">{text}</p>
          </div>
        )}
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
  /** Whether drag-and-drop is enabled (default: true) */
  draggable?: boolean;
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
            "h-7 w-7 bg-muted hover:bg-muted",
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
  draggable = true,
}: ThumbnailCardProps) {
  // Get all actions and currentUserId from context
  const {
    currentUserId,
    projects,
    onFavoriteToggle,
    onDownload,
    onShare,
    onCopy,
    onEdit,
    onDelete,
    onAddToProject,
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
    projectId,
  } = thumbnail;

  const { hasWatermark } = useSubscription();
  const { url: watermarkedUrl } = useWatermarkedImage(imageUrl, {
    enabled: hasWatermark(),
  });
  const showWatermark = hasWatermark();
  const displaySrc = showWatermark ? (watermarkedUrl ?? imageUrl) : imageUrl;
  const display400w = showWatermark ? displaySrc : thumbnail400wUrl;
  const display800w = showWatermark ? displaySrc : thumbnail800wUrl;

  // Setup draggable - pass thumbnail data for drop handling
  const dragData: DragData = {
    type: "thumbnail",
    id,
    item: thumbnail,
    imageUrl, // Include imageUrl for style references
  };
  
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `thumbnail-${id}`,
    data: dragData,
    disabled: !draggable || generating,
  });

  // Check if current user owns this thumbnail
  const isOwner = currentUserId && authorId && currentUserId === authorId;

  // Controlled HoverCard + project dropdown: keep HoverCard open while dropdown is open
  // so the action bar (and dropdown trigger) don't unmount when moving to the list
  const [hoverOpen, setHoverOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const handleHoverCardOpenChange = useCallback((open: boolean) => {
    if (open) {
      setHoverOpen(true);
    } else if (!projectDropdownOpen) {
      setHoverOpen(false);
    }
  }, [projectDropdownOpen]);

  // Show logo loading state for items currently being generated
  if (generating) {
    return <ThumbnailCardGenerating text={name} />;
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

  const handleAddToProject = useCallback(
    (e: React.MouseEvent, selectedProjectId: string | null) => {
      e.stopPropagation();
      if (selectedProjectId === (projectId ?? null)) return; // no-op: same project
      onAddToProject(id, selectedProjectId);
    },
    [id, projectId, onAddToProject]
  );

  const handleClick = useCallback(() => {
    onView(thumbnail);
  }, [thumbnail, onView]);

  const projectActionLabel = projectId == null ? "Add to project" : "Move to project";
  const hasProjects = projects && projects.length > 0;

  /** Action bar content - shared between HoverCard pop-up (keeps design consistent) */
  const actionBar = (
    <div className="flex items-center justify-center gap-1">
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
      {isOwner && (
        <DropdownMenu open={projectDropdownOpen} onOpenChange={setProjectDropdownOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 bg-muted hover:bg-muted"
                  disabled={!hasProjects}
                  onClick={(e) => e.stopPropagation()}
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {hasProjects ? projectActionLabel : "Create a project first"}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" side="top" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={(e) => handleAddToProject(e as unknown as React.MouseEvent, null)}
            >
              No project
            </DropdownMenuItem>
            {projects?.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={(e) => handleAddToProject(e as unknown as React.MouseEvent, project.id)}
              >
                {project.name}
                {project.id === projectId ? " (current)" : ""}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {isOwner && (
        <ActionButton
          icon={Pencil}
          label="Edit"
          onClick={handleEdit}
        />
      )}
      {isOwner && (
        <ActionButton
          icon={Trash2}
          label="Delete"
          onClick={handleDelete}
          variant="destructive"
        />
      )}
    </div>
  );

  return (
    <HoverCard
      open={hoverOpen}
      onOpenChange={handleHoverCardOpenChange}
      openDelay={150}
      closeDelay={100}
    >
      <HoverCardTrigger asChild>
        <Card
          ref={setNodeRef}
          className={cn(
            "group relative aspect-video w-full cursor-pointer overflow-hidden p-0 transition-all",
            "hover:ring-2 hover:ring-primary/50 hover:shadow-lg",
            isDragging && "opacity-50 ring-2 ring-primary cursor-grabbing",
            draggable && !isDragging && "cursor-grab"
          )}
          onClick={handleClick}
          {...listeners}
          {...attributes}
        >
          <div className="relative h-full w-full overflow-hidden bg-muted">
            {/* Image with scale animation on hover */}
            <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
              <ProgressiveImage
                src={displaySrc}
                src400w={display400w}
                src800w={display800w}
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
              <p className="max-w-[70%] truncate text-sm font-medium text-white drop-shadow-sm">
                {name}
              </p>
              <ResolutionBadge resolution={resolution} />
            </div>
          </div>
        </Card>
      </HoverCardTrigger>
      {/* Action bar in pop-up above thumbnail - icons only, no card background */}
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-auto border-0 bg-transparent p-0 shadow-none ring-0"
      >
        {actionBar}
      </HoverCardContent>
    </HoverCard>
  );
});

export default ThumbnailCard;
