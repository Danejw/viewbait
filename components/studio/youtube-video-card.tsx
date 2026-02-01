"use client";

/**
 * YouTubeVideoCard Component
 *
 * Card for displaying a YouTube video thumbnail and title.
 * Mirrors ThumbnailCard look and feel: same Card, aspect-video, border/radius.
 * Optional link to open video on YouTube. No add-to-project or delete actions.
 */

import React, { memo, useCallback, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";

export interface YouTubeVideoCardVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface YouTubeVideoCardProps {
  video: YouTubeVideoCardVideo;
  /** First few items load eagerly */
  priority?: boolean;
  /** When provided, show checkbox overlay for selection (e.g. Extract style) */
  selected?: boolean;
  /** Called when user toggles selection; when provided, card click toggles selection instead of opening YouTube */
  onToggleSelect?: (videoId: string) => void;
}

const YOUTUBE_WATCH_URL = "https://www.youtube.com/watch?v=";

/**
 * Skeleton card for loading state (matches ThumbnailCardSkeleton: image area only).
 */
export function YouTubeVideoCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden p-0">
      <div className="relative aspect-video w-full">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </Card>
  );
}

/**
 * YouTubeVideoCard – matches ThumbnailCard layout and styling:
 * Card is aspect-video only (no content below image). Title + icon in top overlay on hover
 * with same gradient, animation (-translate-y-2 → translate-y-0), and typography.
 * Click opens video on YouTube in new tab.
 */
export const YouTubeVideoCard = memo(function YouTubeVideoCard({
  video,
  priority = false,
  selected = false,
  onToggleSelect,
}: YouTubeVideoCardProps) {
  const { videoId, title, thumbnailUrl } = video;
  const [ref, isIntersecting] = useIntersectionObserver({
    rootMargin: "200px",
  });
  const [isLoaded, setIsLoaded] = useState(false);

  const showImage = priority || isIntersecting;
  const watchUrl = `${YOUTUBE_WATCH_URL}${videoId}`;
  const selectionMode = onToggleSelect != null;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (selectionMode) {
        e.preventDefault();
        onToggleSelect(videoId);
      } else {
        window.open(watchUrl, "_blank", "noopener,noreferrer");
      }
    },
    [selectionMode, onToggleSelect, videoId, watchUrl]
  );

  const handleCheckboxChange = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleSelect?.(videoId);
    },
    [onToggleSelect, videoId]
  );

  return (
    <div ref={ref} className="w-full">
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              "group relative aspect-video w-full cursor-pointer overflow-hidden p-0 transition-all",
              "hover:ring-2 hover:ring-primary/50 hover:shadow-lg",
              selectionMode && selected && "ring-2 ring-primary"
            )}
            onClick={handleClick}
          >
            <div className="relative h-full w-full overflow-hidden bg-muted">
              {showImage && (
                <>
                  {!isLoaded && (
                    <Skeleton className="absolute inset-0 h-full w-full" />
                  )}
                  {/* Image with scale animation on hover (same as ThumbnailCard) */}
                  <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
                    <img
                      src={thumbnailUrl}
                      alt={title}
                      onLoad={() => setIsLoaded(true)}
                      loading={priority ? "eager" : "lazy"}
                      decoding="async"
                      className={cn(
                        "h-full w-full object-cover transition-all duration-300",
                        isLoaded ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </>
              )}
              {/* Selection mode: checkbox overlay top-left */}
              {selectionMode && (
                <div
                  className="absolute left-2 top-2 z-10"
                  onClick={handleCheckboxChange}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleSelect?.(videoId);
                    }
                  }}
                  aria-label={selected ? "Deselect video" : "Select video"}
                >
                  <Checkbox
                    checked={selected}
                    className="h-5 w-5 border-2 border-white bg-black/50 shadow-md pointer-events-none"
                  />
                </div>
              )}
              {/* Top overlay – title (left) and external link (right); same as ThumbnailCard name + badge */}
              <div
                className={cn(
                  "absolute inset-x-0 top-0 flex items-start justify-between p-2",
                  "bg-gradient-to-b from-black/60 to-transparent",
                  "opacity-0 -translate-y-2 transition-all duration-200 ease-out",
                  "group-hover:opacity-100 group-hover:translate-y-0",
                  selectionMode && "pl-10"
                )}
              >
                <p
                  className="max-w-[70%] truncate text-sm font-medium text-white drop-shadow-sm"
                  title={title}
                >
                  {title}
                </p>
                {!selectionMode && (
                  <ExternalLink className="h-4 w-4 shrink-0 text-white drop-shadow-sm" />
                )}
              </div>
            </div>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="top">
          {selectionMode
            ? selected
              ? "Deselect for style extraction"
              : "Select for style extraction"
            : "Open on YouTube"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
});

export default YouTubeVideoCard;
