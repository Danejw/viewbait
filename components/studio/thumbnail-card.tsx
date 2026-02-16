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

import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Heart, Download, Copy, Pencil, Trash2, FolderPlus, AlertCircle, ScanLine, Thermometer, Crown, Medal, Youtube } from "lucide-react";
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
import { ActionBarIcon, ActionButton } from "@/components/studio/action-bar-icon";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { fetchImageAsBase64Client } from "@/lib/utils/fetch-image-as-base64-client";
import { normalizeAspectRatio } from "@/lib/utils/aspect-ratio";
import { generateThumbnailHeatmap } from "@/lib/services/thumbnail-heatmap";
import type { Thumbnail } from "@/lib/types/database";
import type { DragData } from "./studio-dnd-context";

const HEATMAP_QUERY_KEY = "thumbnail-heatmap" as const;

/** Medal tier for clicks badge: gold (1st), silver (2nd), bronze (3rd), or default green. */
type ClicksBadgeTier = "gold" | "silver" | "bronze" | null;

/**
 * Approval score badge (share gallery clicks) – bottom-right corner triangle with count.
 * Color follows rank: gold / silver / bronze for top 3, green otherwise. Visible only on hover when count > 0.
 */
function ApprovalScoreBadge({
  count,
  tier,
}: {
  count: number;
  tier?: ClicksBadgeTier;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "thumbnail-clicks-badge z-20",
        tier === "gold" && "thumbnail-clicks-badge-gold",
        tier === "silver" && "thumbnail-clicks-badge-silver",
        tier === "bronze" && "thumbnail-clicks-badge-bronze",
        "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      )}
      title="Clicks from shared gallery"
      aria-hidden
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

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
 * Card shown when generation failed (e.g. Gemini API error).
 * Uses the same CRT effect as loading state but with error variant (red tint);
 * overlays error icon, message, and Dismiss so it matches the thumbnail card / CRT look.
 * Exported for use in RecentThumbnailsStrip.
 */
export function ThumbnailCardFailed({
  text,
  error,
  onDismiss,
}: {
  text?: string;
  error: string;
  onDismiss: () => void;
}) {
  return (
    <Card className="group relative overflow-hidden p-0">
      <div className="relative aspect-video w-full">
        <CRTLoadingEffect
          variant="error"
          className="absolute inset-0 h-full w-full !aspect-auto rounded-lg"
        />
        <div className="absolute inset-0 z-[1] flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertCircle className="h-8 w-8 shrink-0 text-destructive drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
            {text && (
              <p
                className="truncate w-full text-xs text-muted-foreground drop-shadow-[0_0_4px_rgba(0,0,0,0.8)]"
                title={text}
              >
                {text}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onDismiss}
              className="border-destructive/60 text-destructive hover:bg-destructive/15 hover:text-destructive"
            >
              Dismiss
            </Button>
          </div>
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

/** Border and/or shading for click-rank. Medals use className; rank 4+ use shadingClass only. */
export type ClickRankBorderStyle = {
  className?: string;
  style?: Record<string, string | number>;
  shadingClass?: string;
};

export interface ThumbnailCardProps {
  thumbnail: Thumbnail;
  priority?: boolean;
  /** Whether drag-and-drop is enabled (default: true) */
  draggable?: boolean;
  /** Optional click-rank border (wrapper layer); does not override hover/drag ring on Card */
  clickRankBorder?: ClickRankBorderStyle;
  /** Whether to show the share-gallery clicks badge on hover (default: true). Set false e.g. in recent creations strip. */
  showClicksBadge?: boolean;
}

/**
 * Progressive image component with lazy loading and scale animation.
 * Optional onLoad is called when the image has loaded and is ready to display.
 */
const ProgressiveImage = memo(function ProgressiveImage({
  src,
  src400w,
  src800w,
  alt,
  priority = false,
  className,
  onLoad,
}: {
  src: string;
  src400w?: string | null;
  src800w?: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
  /** Called when the image has loaded and is ready to display */
  onLoad?: () => void;
}) {
  const [ref, isIntersecting] = useIntersectionObserver({
    rootMargin: "200px",
  });
  const imgRef = useRef<HTMLImageElement | null>(null);
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
    onLoad?.();
    if (currentSrc === src400w && (src800w || src)) {
      setCurrentSrc(src800w || src);
    }
  }, [currentSrc, src400w, src800w, src, onLoad]);

  React.useEffect(() => {
    if (imageSrc && !currentSrc) {
      setCurrentSrc(imageSrc);
    }
  }, [imageSrc, currentSrc]);

  // If the image is already complete (cached or very fast load), the load event may have fired
  // before we attached the listener. Check after mount and call onLoad so the CRT overlay clears.
  React.useEffect(() => {
    if (!currentSrc || isLoaded) return;
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setIsLoaded(true);
      onLoad?.();
    }
  }, [currentSrc, isLoaded, onLoad]);

  return (
    <div ref={ref} className={cn("relative h-full w-full", className)}>
      {!isLoaded && (
        <Skeleton className="absolute inset-0 h-full w-full" />
      )}
      {currentSrc && (
        <img
          ref={imgRef}
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
 * Memoized ThumbnailCard component
 * Uses useThumbnailActions hook to get all actions from context
 * Only re-renders when thumbnail data changes
 */
export const ThumbnailCard = memo(function ThumbnailCard({
  thumbnail,
  priority = false,
  draggable = true,
  clickRankBorder,
  showClicksBadge = true,
}: ThumbnailCardProps) {
  // Get all actions and currentUserId from context
  const {
    currentUserId,
    projects,
    canSetYouTubeThumbnail,
    onFavoriteToggle,
    onDownload,
    onCopy,
    onEdit,
    onDelete,
    onAddToProject,
    onAnalyzeThumbnailForInstructions,
    onSetOnYouTube,
    onView,
    onDismissFailed,
  } = useThumbnailActions();

  const {
    id,
    name,
    imageUrl,
    thumbnail400wUrl,
    thumbnail800wUrl,
    isFavorite,
    generating,
    error: thumbnailError,
    resolution,
    authorId,
    projectId,
    shareClickCount,
  } = thumbnail;

  const { hasWatermark, tier } = useSubscription();
  const canUseHeatmap = tier === "advanced" || tier === "pro";
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysisSuccessBorder, setShowAnalysisSuccessBorder] = useState(false);
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState(false);
  const [rankBorderMousePosition, setRankBorderMousePosition] = useState<{ x: number; y: number } | null>(null);
  const rankBorderWrapperRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const cachedHeatmapDataUrl = useQuery({
    queryKey: [HEATMAP_QUERY_KEY, id],
    queryFn: () => Promise.resolve(undefined as unknown as string),
    enabled: false,
  }).data as string | undefined;

  const heatmapMutation = useMutation({
    mutationFn: async () => {
      const payload = await fetchImageAsBase64Client(displaySrc);
      if (!payload) throw new Error("Could not load image");
      return generateThumbnailHeatmap({
        imageData: payload.data,
        mimeType: payload.mimeType,
        thumbnailId: id,
      });
    },
    onSuccess: (result) => {
      queryClient.setQueryData([HEATMAP_QUERY_KEY, id], result.dataUrl);
      setShowHeatmapOverlay(true);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to generate heatmap");
    },
  });

  // CRT overlay stays until the image has loaded (continuous visual feedback after generation).
  // Only reset when thumbnail identity (id) changes, not when displaySrc changes (e.g. watermark URL
  // resolving), so the overlay does not reappear when switching from imageUrl to watermarkedUrl.
  const [imageLoaded, setImageLoaded] = useState(false);
  React.useEffect(() => {
    setImageLoaded(false);
  }, [id]);

  // Clear success border after a short delay so it doesn't stay forever
  React.useEffect(() => {
    if (!showAnalysisSuccessBorder) return;
    const t = setTimeout(() => setShowAnalysisSuccessBorder(false), 2500);
    return () => clearTimeout(t);
  }, [showAnalysisSuccessBorder]);

  const handleHoverCardOpenChange = useCallback((open: boolean) => {
    if (open) {
      setHoverOpen(true);
    } else if (!projectDropdownOpen) {
      setHoverOpen(false);
    }
  }, [projectDropdownOpen]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // Show CRT loading state for items currently being generated
  if (generating) {
    return <ThumbnailCardGenerating text={name} />;
  }

  // Show failed state when generation failed (e.g. Gemini API error)
  if (thumbnailError && onDismissFailed) {
    return (
      <ThumbnailCardFailed
        text={name}
        error={thumbnailError}
        onDismiss={() => onDismissFailed(id)}
      />
    );
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

  const handleAnalyzeStyle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onAnalyzeThumbnailForInstructions || isAnalyzing) return;
      setIsAnalyzing(true);
      onAnalyzeThumbnailForInstructions({ thumbnailId: id, imageUrl: displaySrc })
        .finally(() => setIsAnalyzing(false));
    },
    [id, displaySrc, onAnalyzeThumbnailForInstructions, isAnalyzing]
  );

  const handleHeatmapClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canUseHeatmap) return;
      if (cachedHeatmapDataUrl) {
        setShowHeatmapOverlay((prev) => !prev);
      } else {
        heatmapMutation.mutate();
      }
    },
    [canUseHeatmap, cachedHeatmapDataUrl, heatmapMutation]
  );

  const handleClick = useCallback(() => {
    onView(thumbnail);
  }, [thumbnail, onView]);

  const handleRankBorderMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = rankBorderWrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setRankBorderMousePosition({ x, y });
  }, []);
  const handleRankBorderMouseLeave = useCallback(() => {
    setRankBorderMousePosition(null);
  }, []);

  const projectActionLabel = projectId == null ? "Add to project" : "Move to project";
  const hasProjects = projects && projects.length > 0;

  /** Action bar content - shared between HoverCard pop-up (keeps design consistent) */
  const actionBar = (
    <motion.div
      className="flex items-center justify-center gap-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
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
        icon={Copy}
        label="Copy link"
        onClick={handleCopy}
      />
      <ActionButton
        icon={isAnalyzing ? ViewBaitLogo : ScanLine}
        label="Analyze style and add to instructions"
        onClick={handleAnalyzeStyle}
        disabled={isAnalyzing}
        iconClassName={isAnalyzing ? "animate-spin" : undefined}
      />
      {canSetYouTubeThumbnail && isOwner && (
        <ActionButton
          icon={Youtube}
          label="Set on YouTube"
          onClick={(e) => {
            e.stopPropagation();
            onSetOnYouTube(thumbnail);
          }}
        />
      )}
      {canUseHeatmap && (
        <ActionButton
          icon={heatmapMutation.isPending ? ViewBaitLogo : Thermometer}
          label={showHeatmapOverlay ? "Hide heatmap" : "Attention heatmap"}
          onClick={handleHeatmapClick}
          disabled={heatmapMutation.isPending}
          active={showHeatmapOverlay}
          iconClassName={heatmapMutation.isPending ? "animate-spin" : undefined}
        />
      )}
      {isOwner && (
        <DropdownMenu open={projectDropdownOpen} onOpenChange={setProjectDropdownOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <ActionBarIcon className="disabled:hover:scale-100 [&:has(button:disabled)]:hover:scale-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 bg-muted hover:bg-muted"
                    disabled={!hasProjects}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </ActionBarIcon>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {hasProjects ? projectActionLabel : "Create a project first"}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" side="top" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onSelect={() => {
                onAddToProject(id, null, projectId ?? null);
              }}
            >
              No project
            </DropdownMenuItem>
            {projects?.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onSelect={() => {
                  if (project.id === (projectId ?? null)) return;
                  onAddToProject(id, project.id, projectId ?? null);
                }}
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
    </motion.div>
  );

  /** Medal tier for overlay (gold = King/Crown, silver/bronze = Medal icon + aura). */
  const medalTier =
    clickRankBorder?.className?.includes("click-rank-border-gold")
      ? "gold"
      : clickRankBorder?.className?.includes("click-rank-border-silver")
        ? "silver"
        : clickRankBorder?.className?.includes("click-rank-border-bronze")
          ? "bronze"
          : null;

  /** Trigger shimmer sweep on hover (gold/silver/bronze only). */
  const [shimmerActive, setShimmerActive] = useState(false);
  const runShimmer = useCallback(() => {
    setShimmerActive(false);
    setTimeout(() => setShimmerActive(true), 20);
  }, []);
  const handleShimmerEnd = useCallback(() => {
    setShimmerActive(false);
  }, []);

  /* Rank border is applied on a wrapper layer so Card keeps hover:ring and drag ring intact. */
  const cardContent = (
    <Card
      ref={setNodeRef}
      data-tour="tour.studio.results.card.thumbnail"
      style={{ aspectRatio: normalizeAspectRatio(thumbnail?.aspect_ratio ?? null) }}
      className={cn(
            "group relative z-0 w-full cursor-pointer overflow-hidden p-0 transition-all",
            "hover:z-20 hover:ring-2 hover:ring-primary/50 hover:shadow-lg",
            isDragging && "opacity-50 ring-2 ring-primary cursor-grabbing",
            draggable && !isDragging && "cursor-grab",
            (isAnalyzing || heatmapMutation.isPending) && "thumbnail-card-border-loading",
            showAnalysisSuccessBorder && "thumbnail-card-border-success"
          )}
          onClick={handleClick}
          {...listeners}
          {...attributes}
        >
          {isAnalyzing || heatmapMutation.isPending ? (
            <div className={cn("studio-analyzing-wrapper", "is-analyzing")}>
              <div className="studio-analyzing-card">
                {displaySrc && (
                  <img
                    src={displaySrc}
                    alt={name}
                    className="studio-analyzing-thumbnail"
                  />
                )}
                {!displaySrc && (
                  <div className="absolute inset-0 bg-muted" aria-hidden />
                )}
                <div className="studio-analyzing-scanlines" aria-hidden />
                <div className="studio-analyzing-scan-line" aria-hidden />
                <div className="studio-analyzing-rgb" aria-hidden />
                <div className="studio-analyzing-vignette" aria-hidden />
                <div className="studio-analyzing-corner tl" aria-hidden />
                <div className="studio-analyzing-corner tr" aria-hidden />
                <div className="studio-analyzing-corner bl" aria-hidden />
                <div className="studio-analyzing-corner br" aria-hidden />
                <div className="studio-analyzing-status">
                  <div className="studio-analyzing-status-dot" aria-hidden />
                  <span className="studio-analyzing-status-text">
                    {heatmapMutation.isPending ? "HEATMAP" : "ANALYZING"}
                  </span>
                </div>
                <div className="studio-analyzing-title">
                  <div className="studio-analyzing-title-text">{name}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative h-full w-full overflow-hidden bg-muted">
              {/* Clicks count badge: top-left, circular green, only on hover when count > 0 */}
              {showClicksBadge && (
                <ApprovalScoreBadge count={shareClickCount ?? 0} tier={medalTier} />
              )}
              {/* Image with scale animation on hover */}
              <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
                <ProgressiveImage
                  src={displaySrc}
                  src400w={display400w}
                  src800w={display800w}
                  alt={name}
                  priority={priority}
                  onLoad={handleImageLoad}
                />
              </div>
              {/* CRT overlay until image has loaded (continuous visual feedback after generation) */}
              {!imageLoaded && displaySrc && (
                <div className="absolute inset-0 z-10">
                  <CRTLoadingEffect className="h-full w-full !aspect-auto rounded-lg" />
                </div>
              )}

              {/* Heatmap overlay (Advanced/Pro): toggle on/off to compare attention areas */}
              {showHeatmapOverlay && cachedHeatmapDataUrl && (
                <div
                  className="absolute inset-0 z-10 pointer-events-none"
                  aria-hidden
                >
                  <img
                    src={cachedHeatmapDataUrl}
                    alt=""
                    className="h-full w-full object-cover opacity-60"
                  />
                </div>
              )}

              {/* Rank medal overlay: aura, ring, and King/Medal icon (gold/silver/bronze only) */}
              {medalTier && (
                <div
                  className={cn("rank-medal-overlay", `rank-medal-overlay-${medalTier}`)}
                  aria-hidden
                >
                  <div className="rank-medal-corner tr" aria-hidden />
                  <div className="rank-medal-corner tl" aria-hidden />
                  <div className="rank-medal-corner bl" aria-hidden />
                  <div className="rank-medal-corner br" aria-hidden />
                  <div className="rank-medal-badge" title={medalTier === "gold" ? "Most clicked in this project" : medalTier === "silver" ? "2nd most clicked" : "3rd most clicked"}>
                    {medalTier === "gold" ? (
                      <Crown className="h-6 w-6 shrink-0" />
                    ) : (
                      <Medal className="h-6 w-6 shrink-0" />
                    )}
                  </div>
                </div>
              )}

              {/* Rank shading overlay (rank 4+ only; no border, no icon) */}
              {clickRankBorder?.shadingClass && (
                <div className={clickRankBorder.shadingClass} aria-hidden />
              )}

              {/* Top overlay - Title (left) and Resolution / Approval score (right); smooth in/out from top */}
              <div
                className={cn(
                  "absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2",
                  "bg-gradient-to-b from-black/60 to-transparent",
                  "opacity-0 -translate-y-2 transition-all duration-200 ease-out",
                  "group-hover:opacity-100 group-hover:translate-y-0"
                )}
              >
                <p className="max-w-[70%] truncate text-sm font-medium text-white drop-shadow-sm">
                  {name}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <ResolutionBadge resolution={resolution} />
                </div>
              </div>
            </div>
          )}
        </Card>
  );

  return (
    <HoverCard
      open={hoverOpen}
      onOpenChange={handleHoverCardOpenChange}
      openDelay={150}
      closeDelay={100}
    >
      <HoverCardTrigger asChild>
        {clickRankBorder?.className ? (
          <div
            ref={rankBorderWrapperRef}
            className={cn("relative z-0 rounded-lg hover:z-20", clickRankBorder.className)}
            style={{
              ...clickRankBorder.style,
              "--rank-mouse-x": rankBorderMousePosition ? `${rankBorderMousePosition.x}%` : "-100%",
              "--rank-mouse-y": rankBorderMousePosition ? `${rankBorderMousePosition.y}%` : "-100%",
            } as React.CSSProperties}
            onMouseMove={handleRankBorderMouseMove}
            onMouseEnter={runShimmer}
            onMouseLeave={handleRankBorderMouseLeave}
          >
            {medalTier && (
              <div
                className={cn(
                  "rank-shimmer-overlay",
                  "rank-shimmer-" + medalTier,
                  shimmerActive && "rank-shimmer-active"
                )}
                onAnimationEnd={handleShimmerEnd}
                aria-hidden
              />
            )}
            {cardContent}
          </div>
        ) : (
          cardContent
        )}
      </HoverCardTrigger>
      {/* Action bar in pop-up above thumbnail - icons only, no card background; smooth in/out */}
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-auto border-0 bg-transparent p-0 shadow-none ring-0 duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[side=top]:data-open:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=top]:data-closed:slide-out-to-bottom-2"
      >
        {actionBar}
      </HoverCardContent>
    </HoverCard>
  );
});

export default ThumbnailCard;
