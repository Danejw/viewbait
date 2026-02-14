"use client";

/**
 * SharedGalleryCard – read-only thumbnail card for shared project gallery.
 * Matches ThumbnailCard hover animations (scale, ring, shadow, title/resolution overlay).
 * Optional onClick opens full-size view in parent (e.g. ImageModal).
 * When canComment and projectId are set, shows a comment icon that opens a modal to view/post comments.
 */

import React, { memo, useCallback, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActionButton } from "@/components/studio/action-bar-icon";
import { cn } from "@/lib/utils";
import { normalizeAspectRatio } from "@/lib/utils/aspect-ratio";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import { useThumbnailComments, usePostThumbnailComment } from "@/lib/hooks/useThumbnailComments";
import { toast } from "sonner";
import type { PublicThumbnailData } from "@/lib/types/database";

const COMMENT_MAX_LENGTH = 500;

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
  /** When true and projectId is set, show comment icon and allow posting comments. */
  canComment?: boolean;
  projectId?: string | null;
  /** Shared gallery slug; passed so comment mutation can invalidate gallery cache. */
  slug?: string | null;
  /** Called after a comment is successfully posted. */
  onCommentSuccess?: () => void;
}

export const SharedGalleryCard = memo(function SharedGalleryCard({
  thumbnail,
  onClick,
  canComment = false,
  projectId = null,
  slug = null,
  onCommentSuccess,
}: SharedGalleryCardProps) {
  const [ref, isIntersecting] = useIntersectionObserver({ rootMargin: "200px" });
  const [loaded, setLoaded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draftComment, setDraftComment] = useState("");
  const src = thumbnail.thumbnail_400w_url || thumbnail.thumbnail_800w_url || thumbnail.image_url;

  const showCommentUi = canComment && projectId;

  const { comments, isLoading: commentsLoading, error: commentsError } = useThumbnailComments(
    commentsOpen ? thumbnail.id : null,
    commentsOpen && projectId ? projectId : null,
    { enabled: commentsOpen && !!projectId }
  );

  const { postComment, isPosting } = usePostThumbnailComment({ slug });

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

  const handleCommentClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCommentsOpen(true);
  }, []);

  const handlePostComment = useCallback(async () => {
    if (!projectId) return;
    const trimmed = draftComment.trim();
    if (trimmed.length < 1 || trimmed.length > COMMENT_MAX_LENGTH) {
      toast.error(`Comment must be 1–${COMMENT_MAX_LENGTH} characters`);
      return;
    }
    try {
      const result = await postComment({ thumbnailId: thumbnail.id, projectId, comment: trimmed });
      if (result.error) {
        toast.error(result.error.message || "Failed to post comment");
        return;
      }
      setDraftComment("");
      onCommentSuccess?.();
      toast.success("Comment posted");
    } catch {
      toast.error("Failed to post comment");
    }
  }, [projectId, draftComment, thumbnail.id, postComment, onCommentSuccess]);

  const isClickable = Boolean(onClick);

  return (
    <>
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

          {/* Comment icon (bottom-right) when user can comment */}
          {showCommentUi && (
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 flex justify-end p-2",
                "bg-gradient-to-t from-black/60 to-transparent",
                "opacity-0 transition-opacity duration-200 ease-out",
                "group-hover:opacity-100"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <ActionButton
                icon={MessageCircle}
                label="Comments"
                onClick={handleCommentClick}
              />
            </div>
          )}
        </div>
      </Card>

      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {commentsLoading && (
              <p className="text-sm text-muted-foreground">Loading comments…</p>
            )}
            {commentsError && (
              <p className="text-sm text-destructive">{commentsError.message}</p>
            )}
            {!commentsLoading && !commentsError && (
              <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto hide-scrollbar">
                {comments.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No comments yet.</li>
                ) : (
                  comments.map((c, i) => (
                    <li key={`${c.user_id}-${c.created_at}-${i}`} className="text-sm">
                      <span className="text-muted-foreground font-medium">{c.comment}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              <Textarea
                placeholder="Add a comment (1–500 characters)"
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value.slice(0, COMMENT_MAX_LENGTH))}
                maxLength={COMMENT_MAX_LENGTH}
                rows={3}
                className="resize-none"
              />
              <Button
                onClick={handlePostComment}
                disabled={isPosting || !draftComment.trim()}
                size="sm"
              >
                {isPosting ? "Posting…" : "Post"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
