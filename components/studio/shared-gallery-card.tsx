"use client";

/**
 * SharedGalleryCard – read-only thumbnail card for shared project gallery.
 * Matches ThumbnailCard hover animations (scale, ring, shadow, title/resolution overlay).
 * Optional onClick opens full-size view in parent (e.g. ImageModal).
 * Includes comment button for adding feedback on thumbnails.
 */

import React, { memo, useCallback, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizeAspectRatio } from "@/lib/utils/aspect-ratio";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import { ActionBarIcon } from "@/components/studio/action-bar-icon";
import { ThumbnailCommentDialog } from "@/components/studio/thumbnail-comment-dialog";
import { addThumbnailComment } from "@/lib/services/projects";
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
  /** Share slug for the project (required for comment functionality) */
  shareSlug?: string;
  /** Callback when comment is added (for refreshing data) */
  onCommentAdded?: () => void;
}

export const SharedGalleryCard = memo(function SharedGalleryCard({
  thumbnail,
  onClick,
  shareSlug,
  onCommentAdded,
}: SharedGalleryCardProps) {
  const [ref, isIntersecting] = useIntersectionObserver({ rootMargin: "200px" });
  const [loaded, setLoaded] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const src = thumbnail.thumbnail_400w_url || thumbnail.thumbnail_800w_url || thumbnail.image_url;

  const commentCount = thumbnail.comments?.length ?? 0;

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

  const handleCommentClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (shareSlug) {
        setCommentDialogOpen(true);
      }
    },
    [shareSlug]
  );

  const handleCommentSubmit = useCallback(
    async (comment: string) => {
      if (!shareSlug) {
        return { comments: null, error: new Error("Share slug is required") };
      }
      return await addThumbnailComment(shareSlug, thumbnail.id, comment);
    },
    [shareSlug, thumbnail.id]
  );

  const handleCommentAdded = useCallback(() => {
    onCommentAdded?.();
  }, [onCommentAdded]);

  const isClickable = Boolean(onClick);

  return (
    <Card
      style={{ aspectRatio: normalizeAspectRatio(thumbnail.aspect_ratio) }}
      className={cn(
        "group relative w-full overflow-hidden p-0 transition-all",
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

        {/* Comment button - bottom right, visible on hover */}
        {shareSlug && (
          <div
            className={cn(
              "absolute bottom-2 right-2",
              "opacity-0 transition-opacity duration-200 ease-out",
              "group-hover:opacity-100"
            )}
            onClick={handleCommentClick}
          >
            <ActionBarIcon>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 bg-muted/80 hover:bg-muted relative"
                aria-label="Add comment"
              >
                <MessageSquare className="h-4 w-4" />
                {commentCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {commentCount > 99 ? "99+" : commentCount}
                  </span>
                )}
              </Button>
            </ActionBarIcon>
          </div>
        )}
      </div>

      {/* Comment dialog */}
      {shareSlug && (
        <ThumbnailCommentDialog
          open={commentDialogOpen}
          onOpenChange={setCommentDialogOpen}
          thumbnailTitle={thumbnail.title}
          onSubmit={handleCommentSubmit}
          onCommentAdded={handleCommentAdded}
        />
      )}
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
