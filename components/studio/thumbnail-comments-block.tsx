"use client";

/**
 * ThumbnailCommentsBlock
 *
 * Read-only comments block for the thumbnail ImageModal in studio.
 * Renders only when the viewer is the thumbnail owner (isOwner).
 * Uses owner-only API path when projectId is omitted; same plain-text list as shared gallery.
 */

import { useThumbnailComments } from "@/lib/hooks/useThumbnailComments";

export interface ThumbnailCommentsBlockProps {
  thumbnailId: string;
  projectId?: string | null;
  isOwner: boolean;
}

export function ThumbnailCommentsBlock({
  thumbnailId,
  projectId,
  isOwner,
}: ThumbnailCommentsBlockProps) {
  const { comments, isLoading, error } = useThumbnailComments(
    thumbnailId,
    projectId ?? null,
    { enabled: isOwner }
  );

  if (!isOwner) return null;

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-border mt-2">
      <h4 className="text-sm font-medium text-foreground">Comments</h4>
      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error.message}</p>
      )}
      {!isLoading && !error && (
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
    </div>
  );
}
