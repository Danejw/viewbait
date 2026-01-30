"use client";

/**
 * SharedGalleryCard – read-only thumbnail card for shared project gallery.
 * Shows image only (no title); no edit/delete/favorite actions.
 */

import React, { memo, useState } from "react";
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
}

export const SharedGalleryCard = memo(function SharedGalleryCard({
  thumbnail,
}: SharedGalleryCardProps) {
  const [ref, isIntersecting] = useIntersectionObserver({ rootMargin: "200px" });
  const [loaded, setLoaded] = useState(false);
  const src = thumbnail.thumbnail_400w_url || thumbnail.thumbnail_800w_url || thumbnail.image_url;

  return (
    <Card className="group relative overflow-hidden p-0">
      <div ref={ref} className="relative aspect-video w-full">
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
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
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
