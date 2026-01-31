"use client";

/**
 * SharedGalleryCard – read-only thumbnail card for shared project gallery.
 * Matches ThumbnailCard hover animations (scale, ring, shadow, title/resolution overlay).
 * Optional onClick opens full-size view in parent (e.g. ImageModal).
 */

import React, { memo, useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import type { PublicThumbnailData } from "@/lib/types/database";

function ResolutionBadge({ resolution }: { resolution?: string | null }) {
  if (!resolution) return null;
  const colors: Record<string, string> = {
    "1K": "bg-zinc-600",
    "2K": "bg-blue-600",
    "4K": "bg-purple-600",
  };
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium text-white shadow-sm",
        colors[resolution] || "bg-zinc-600"
      )}
    >
      {resolution}
    </span>
  );
}

export interface SharedGalleryCardProps {
  thumbnail: PublicThumbnailData;
  /** When set, card is clickable and opens full-size view in parent (e.g. ImageModal). */
  onClick?: (thumbnail: PublicThumbnailData) => void;
}

export const SharedGalleryCard = memo(function SharedGalleryCard({
  thumbnail,
  onClick,
}: SharedGalleryCardProps) {
  const [ref, isIntersecting] = useIntersectionObserver({ rootMargin: "200px" });
  const [loaded, setLoaded] = useState(false);
  const src = thumbnail.thumbnail_400w_url || thumbnail.thumbnail_800w_url || thumbnail.image_url;

  const handleClick = useCallback(() => {
    onClick?.(thumbnail);
  }, [onClick, thumbnail]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!onClick) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(thumbnail);
      }
    },
    [onClick, thumbnail]
  );

  const isClickable = Boolean(onClick);

  return (
    <Card
      className={cn(
        "group relative aspect-video w-full overflow-hidden p-0 transition-all",
        isClickable && "cursor-pointer hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
      )}
      aria-label={isClickable ? `View ${thumbnail.title}` : undefined}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div ref={ref} className="relative h-full w-full overflow-hidden bg-muted">
        {/* Image with scale animation on hover (matches ThumbnailCard) */}
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
          {!loaded && <Skeleton className="absolute inset-0 h-full w-full" />}
          {isIntersecting && (
            <img
              src={src}
              alt={thumbnail.title}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={cn(
                "h-full w-full object-cover transition-opacity duration-300",
                loaded ? "opacity-100" : "opacity-0"
              )}
            />
          )}
        </div>

        {/* Top overlay – title and resolution (matches ThumbnailCard slide-in on hover) */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex items-start justify-between p-2",
            "bg-gradient-to-b from-black/60 to-transparent",
            "opacity-0 -translate-y-2 transition-all duration-200 ease-out",
            "group-hover:opacity-100 group-hover:translate-y-0"
          )}
        >
          <p className="max-w-[70%] truncate text-sm font-medium text-white drop-shadow-sm">
            {thumbnail.title}
          </p>
          <ResolutionBadge resolution={thumbnail.resolution} />
        </div>
      </div>
    </Card>
  );
});

export function SharedGalleryCardSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="relative aspect-video w-full">
        <Skeleton className="h-full w-full" />
      </div>
    </Card>
  );
}
