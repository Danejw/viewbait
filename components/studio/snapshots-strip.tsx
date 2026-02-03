"use client";

/**
 * SnapshotsStrip
 *
 * Shared horizontal strip for place or character snapshot cards from video frame extraction (FFmpeg.wasm).
 * Each card is draggable to the Faces or Style References drop zones in the right sidebar.
 * Only rendered when there is at least one video with snapshots for the given variant.
 */

import React, { memo, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useStudio } from "@/components/studio/studio-provider";
import { cn } from "@/lib/utils";
import type { DragData } from "@/components/studio/studio-dnd-context";
import type { SnapshotToView } from "@/components/studio/studio-provider";

const CARD_WIDTH = 100;

export type SnapshotsStripVariant = "place" | "character";

export interface SnapshotItem {
  /** For place: placeName; for character: characterName */
  name: string;
  imageBlobUrl: string;
  blob: Blob;
}

interface SnapshotsStripCardProps {
  variant: SnapshotsStripVariant;
  videoId: string;
  index: number;
  name: string;
  imageBlobUrl: string;
  blob: Blob;
}

function SnapshotsStripCard({
  variant,
  videoId,
  index,
  name,
  imageBlobUrl,
  blob,
}: SnapshotsStripCardProps) {
  const { actions } = useStudio();
  const dragIdPrefix = variant === "place" ? "place-snapshot" : "snapshot";
  const dragId = `${dragIdPrefix}-${videoId}-${index}`;
  const dragData: DragData = {
    type: "snapshot",
    id: dragId,
    item: { type: "snapshot", name } as unknown as DragData["item"],
    characterName: name,
    imageBlobUrl,
    blob,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: dragData,
  });

  const handleClick = useCallback(() => {
    const payload: SnapshotToView = {
      videoId,
      index,
      imageBlobUrl,
      blob,
      ...(variant === "place" ? { placeName: name } : { characterName: name }),
    };
    actions.onViewSnapshot(payload);
  }, [actions, videoId, index, name, imageBlobUrl, blob, variant]);

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
      aria-label={`View ${name} snapshot. Drag to Faces or References.`}
    >
      <div className="aspect-square w-full overflow-hidden bg-muted">
        <img
          src={imageBlobUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>
      <p className="truncate px-1.5 py-1 text-xs font-medium text-foreground" title={name}>
        {name}
      </p>
    </div>
  );
}

export interface SnapshotsStripProps {
  variant: SnapshotsStripVariant;
  title: string;
  /** Map of videoId -> list of snapshot items for that video */
  byVideo: Record<string, SnapshotItem[]>;
  ariaLabel: string;
  listAriaLabel: string;
}

export const SnapshotsStrip = memo(function SnapshotsStrip({
  variant,
  title,
  byVideo,
  ariaLabel,
  listAriaLabel,
}: SnapshotsStripProps) {
  const entries = Object.entries(byVideo || {}).filter(([, list]) => list?.length > 0);
  if (entries.length === 0) return null;

  return (
    <section className="mb-4" aria-label={ariaLabel}>
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {title}
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
          aria-label={listAriaLabel}
        >
          {entries.flatMap(([videoId, list]) =>
            list.map((snap, index) => (
              <div key={`${videoId}-${index}`} role="listitem" className="shrink-0">
                <SnapshotsStripCard
                  variant={variant}
                  videoId={videoId}
                  index={index}
                  name={snap.name}
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
