"use client";

/**
 * SnapshotViewModal
 *
 * Full-size view of a character snapshot (same look as ImageModal for thumbnails).
 * The image is draggable so the user can drag it to Faces or Style References drop zones.
 */

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { DragData } from "@/components/studio/studio-dnd-context";
import type { SnapshotToView } from "@/components/studio/studio-provider";

export interface SnapshotViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: SnapshotToView | null;
}

export function SnapshotViewModal({ open, onOpenChange, snapshot }: SnapshotViewModalProps) {
  if (!snapshot) return null;

  const { videoId, index, characterName, placeName, imageBlobUrl, blob } = snapshot;
  const displayName = characterName ?? placeName ?? "Snapshot";
  const dragId = `snapshot-view-${videoId}-${index}`;
  const dragData: DragData = {
    type: "snapshot",
    id: dragId,
    item: { type: "snapshot", name: displayName } as DragData["item"],
    characterName: displayName,
    imageBlobUrl,
    blob,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: dragData,
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="4xl"
        className="flex flex-col gap-0 p-0 border-0 max-w-[75vw] max-h-[95vh] overflow-hidden bg-white dark:bg-black"
        showCloseButton={true}
      >
        <ModalHeader className="absolute top-2 left-2 z-10 pointer-events-none">
          <ModalTitle className="text-foreground drop-shadow-lg text-base font-semibold">
            {characterName}
          </ModalTitle>
        </ModalHeader>
        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden pt-10">
          <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={cn(
              "relative flex flex-1 items-center justify-center min-h-0 w-full cursor-grab active:cursor-grabbing",
              isDragging && "opacity-70"
            )}
          >
            <img
              src={imageBlobUrl}
              alt={displayName}
              className="h-auto max-h-[90vh] w-full object-contain transition-opacity duration-300 pointer-events-none"
              loading="eager"
              draggable={false}
            />
          </div>
        </div>
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-xs text-muted-foreground bg-black/50 dark:bg-white/20 px-2 py-1 rounded pointer-events-none">
          Drag to Faces or References
        </p>
      </ModalContent>
    </Modal>
  );
}
