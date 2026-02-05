"use client";

/**
 * RecentThumbnailsStrip
 *
 * Horizontal strip showing as many recent thumbnails as fit in the container width,
 * plus any in-progress or failed generations. Renders on the YouTube tab so users
 * see new creations without switching to the Create tab. Uses the same ThumbnailCard
 * as the Create grid so view modal, failed dismiss, image URLs, and watermarks stay consistent.
 *
 * - Always visible on YouTube tab; when empty shows a short message + "View all in Create tab".
 * - Card count is responsive: ResizeObserver measures container width and we show
 *   as many cards as fit (min 1 when data exists).
 */

import React, { memo, useCallback, useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getCombinedThumbnailsList } from "@/lib/utils/studio-thumbnails";
import { useStudio } from "@/components/studio/studio-provider";
import { ThumbnailCard } from "@/components/studio/thumbnail-card";

const STRIP_CARD_WIDTH = 140;
const STRIP_GAP_PX = 8;
const STRIP_PADDING_PX = 8;
/** Fallback count before first ResizeObserver callback. */
const FALLBACK_VISIBLE_COUNT = 4;

export const RecentThumbnailsStrip = memo(function RecentThumbnailsStrip() {
  const { data, actions } = useStudio();
  const { thumbnails, generatingItems } = data;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setContainerWidth(container.offsetWidth);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const combinedList = useMemo(
    () => getCombinedThumbnailsList(thumbnails, generatingItems ?? new Map()),
    [thumbnails, generatingItems]
  );

  const visibleCount =
    containerWidth <= 0
      ? FALLBACK_VISIBLE_COUNT
      : Math.max(1, Math.floor((containerWidth - STRIP_PADDING_PX) / (STRIP_CARD_WIDTH + STRIP_GAP_PX)));

  const stripItems = useMemo(
    () => combinedList.slice(0, Math.min(visibleCount, combinedList.length)),
    [combinedList, visibleCount]
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
              ref={containerRef}
              className="w-full min-w-0"
            >
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
            </div>
          )}
        </div>
      </div>
    </section>
  );
});
