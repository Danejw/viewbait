"use client";

/**
 * PlaceSnapshotsStrip
 *
 * Horizontal strip of place snapshot cards from video frame extraction (FFmpeg.wasm).
 * Each card is draggable to the Faces or Style References drop zones in the right sidebar.
 * Only rendered when there is at least one video with place snapshots (placeSnapshotsByVideoId).
 */

import React, { memo, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useStudio } from "@/components/studio/studio-provider";
import { cn } from "@/lib/utils";
import type { DragData } from "@/components/studio/studio-dnd-context";

const CARD_WIDTH = 100;

interface PlaceSnapshotCardProps {
  videoId: string;
  index: number;
  placeName: string;
  imageBlobUrl: string;
  blob: Blob;
}

function PlaceSnapshotCard({ videoId, index, placeName, imageBlobUrl, blob }: PlaceSnapshotCardProps) {
  const { actions } = useStudio();
  const dragId = `place-snapshot-${videoId}-${index}`;
  const dragData: DragData = {
    type: "snapshot",
    id: dragId,
    item: { type: "snapshot", name: placeName } as unknown as DragData["item"],
    characterName: placeName,
    imageBlobUrl,
    blob,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: dragData,
  });

  const handleClick = useCallback(() => {
    actions.onViewSnapshot({ videoId, index, placeName, imageBlobUrl, blob });
  }, [actions, videoId, index, placeName, imageBlobUrl, blob]);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={cn(
        "shrink-0 overflow-hidden rounded-lg border-2 border-border bg-muted/30 transition-all",
        "hover:border-primary/50 hover:shadow-md",
        isDragging && "opacity-50 ring-2 ring-primary cursor-grabbing",
        !isDragging && "cursor-grab"
      )}
      style={{ width: CARD_WIDTH }}
      role="button"
      tabIndex={0}
      aria-label={`View ${placeName} snapshot. Drag to Faces or References.`}
    >
      <div className="aspect-square w-full overflow-hidden bg-muted">
        <img
          src={imageBlobUrl}
          alt={placeName}
          className="h-full w-full object-cover"
        />
      </div>
      <p className="truncate px-1.5 py-1 text-xs font-medium text-foreground" title={placeName}>
        {placeName}
      </p>
    </div>
  );
}

export const PlaceSnapshotsStrip = memo(function PlaceSnapshotsStrip() {
  const { state } = useStudio();
  const byVideo = state.placeSnapshotsByVideoId || {};
  const entries = Object.entries(byVideo).filter(([, list]) => list?.length > 0);
  if (entries.length === 0) return null;

  return (
    <section className="mb-4" aria-label="Place snapshots from video">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Place snapshots
        </h2>
        <p className="text-xs text-muted-foreground">
          Drag to Faces or References on the right to use in thumbnails.
        </p>
        <div
          className={cn(
            "flex gap-2 overflow-x-auto pb-1",
            "hide-scrollbar"
          )}
          role="list"
          aria-label="Place snapshot cards"
        >
          {entries.flatMap(([videoId, list]) =>
            list.map((snap, index) => (
              <div key={`${videoId}-${index}`} role="listitem" className="shrink-0">
                <PlaceSnapshotCard
                  videoId={videoId}
                  index={index}
                  placeName={snap.placeName}
                  imageBlobUrl={snap.imageBlobUrl}
                  blob={snap.blob}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
});
