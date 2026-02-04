"use client";

/**
 * RecentThumbnailsStrip
 *
 * Horizontal strip showing the last ~4 thumbnails plus any in-progress or failed
 * generations. Renders on the YouTube tab so users see new creations without
 * switching to the Create tab. Uses the same ThumbnailCard as the Create grid so
 * view modal, failed dismiss, image URLs, and watermarks stay consistent.
 *
 * - Always visible on YouTube tab; when empty shows a short message + "View all in Create tab".
 * - Cards are size-constrained in a horizontal scroll; click opens the same full-size view modal as in Create.
 */

import React, { memo, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCombinedThumbnailsList } from "@/lib/utils/studio-thumbnails";
import { useStudio } from "@/components/studio/studio-provider";
import { ThumbnailCard } from "@/components/studio/thumbnail-card";

const STRIP_MAX_ITEMS = 4;
const STRIP_CARD_WIDTH = 140;

export const RecentThumbnailsStrip = memo(function RecentThumbnailsStrip() {
  const { data, actions } = useStudio();
  const { thumbnails, generatingItems } = data;

  const combinedList = useMemo(
    () => getCombinedThumbnailsList(thumbnails, generatingItems ?? new Map()),
    [thumbnails, generatingItems]
  );
  const stripItems = useMemo(
    () => combinedList.slice(0, STRIP_MAX_ITEMS),
    [combinedList]
  );
  const isEmpty = stripItems.length === 0;

  const handleViewAll = useCallback(() => {
    actions.setView("generator");
  }, [actions]);

  return (
    <section
      className="mb-4"
      aria-label="Recent thumbnail creations"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recent creations
        </h2>
        <div className="flex items-center gap-3">
          {isEmpty ? (
            <p className="text-sm text-muted-foreground">
              Create a thumbnail from the sidebar to see it here.
            </p>
          ) : (
            <div
              className={cn(
                "flex gap-2 overflow-x-auto p-1",
                "hide-scrollbar"
              )}
              role="list"
              aria-label="Recent thumbnails"
            >
              {stripItems.map((thumbnail, index) => (
                <div
                  key={thumbnail.id}
                  role="listitem"
                  className="shrink-0"
                  style={{ width: STRIP_CARD_WIDTH }}
                >
                  <ThumbnailCard
                    thumbnail={thumbnail}
                    priority={index === 0}
                    draggable={true}
                    showClicksBadge={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});
