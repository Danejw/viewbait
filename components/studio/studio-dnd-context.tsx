"use client";

/**
 * Studio DnD Context
 * 
 * Wraps the studio layout with @dnd-kit DndContext to enable
 * drag-and-drop from style/palette/face/thumbnail cards to the sidebar drop zones.
 * 
 * Features:
 * - Custom drag overlay for smooth visual feedback
 * - Auto-enables toggles when dropping items
 * - Supports styles, palettes, faces, and thumbnails (as style references)
 * 
 * @see https://docs.dndkit.com/ for @dnd-kit documentation
 */

import React, { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  pointerWithin,
} from "@dnd-kit/core";
import { useStudio } from "./studio-provider";
import { DragOverlayPreview } from "./drag-overlay-preview";
import { useChatDropHandler } from "./chat-drop-handler-context";
import type { DbStyle, DbPalette, DbFace, PublicStyle, PublicPalette, Thumbnail } from "@/lib/types/database";

/**
 * Drag item types for type-safe drag data
 */
export type DragItemType = "style" | "palette" | "face" | "thumbnail" | "snapshot";

/**
 * Drag data structure passed via useDraggable
 */
export interface DragData {
  type: DragItemType;
  id: string;
  item: DbStyle | DbPalette | DbFace | PublicStyle | PublicPalette | Thumbnail | { type: "snapshot"; name: string };
  /** Image URL for thumbnails - used when adding to style references */
  imageUrl?: string;
  /** Snapshot drag: character name and blob for creating face or uploading as style ref */
  characterName?: string;
  imageBlobUrl?: string;
  blob?: Blob;
}

/**
 * Drop zone IDs - used by useDroppable in sidebar sections
 */
export const DROP_ZONE_IDS = {
  STYLE: "style-drop-zone",
  PALETTE: "palette-drop-zone",
  FACES: "faces-drop-zone",
  STYLE_REFERENCES: "style-references-drop-zone",
  CHAT_INPUT: "chat-input-drop-zone",
} as const;

interface StudioDndContextProps {
  children: React.ReactNode;
}

/**
 * StudioDndContext
 * 
 * Provides drag-and-drop context for the entire studio.
 * Handles drag events and coordinates with StudioProvider state.
 */
export function StudioDndContext({ children }: StudioDndContextProps) {
  const { actions } = useStudio();
  const chatDropHandlerRef = useChatDropHandler();
  const [activeData, setActiveData] = useState<DragData | null>(null);

  // Configure sensors for mouse, touch, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require slight movement before starting drag
      // This allows click events to still work
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      // Long press to activate on touch devices
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  /**
   * Handle drag start - store active item data for overlay
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) {
      setActiveData(data);
    }
  }, []);

  /**
   * Handle drag end - apply state updates based on where item was dropped
   */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveData(null);

    // If not dropped on a valid target, do nothing
    if (!over) return;

    const data = active.data.current as DragData | undefined;
    if (!data) return;

    const overId = over.id as string;

    // Handle style drop
    if (overId === DROP_ZONE_IDS.STYLE && data.type === "style") {
      // Auto-enable styles if not already enabled
      actions.setIncludeStyles(true);
      // Set the selected style
      actions.setSelectedStyle(data.id);
      return;
    }

    // Handle palette drop
    if (overId === DROP_ZONE_IDS.PALETTE && data.type === "palette") {
      // Auto-enable palettes if not already enabled
      actions.setIncludePalettes(true);
      // Set the selected palette
      actions.setSelectedPalette(data.id);
      return;
    }

    // Handle face drop
    if (overId === DROP_ZONE_IDS.FACES && data.type === "face") {
      // Auto-enable faces if not already enabled
      actions.setIncludeFaces(true);
      // Toggle the face selection (add if not selected)
      actions.toggleFace(data.id);
      return;
    }

    // Handle snapshot drop on Faces: open create-face modal with blob as initial image
    if (overId === DROP_ZONE_IDS.FACES && data.type === "snapshot" && data.blob) {
      actions.setIncludeFaces(true);
      const file = new File([data.blob], "snapshot.png", { type: data.blob.type || "image/png" });
      actions.setPendingFaceFromSnapshot(file, data.characterName ?? "From video");
      actions.closeSnapshotViewModal();
      return;
    }

    // Handle thumbnail drop to style references
    if (overId === DROP_ZONE_IDS.STYLE_REFERENCES && data.type === "thumbnail") {
      // Auto-enable style references so the section expands and shows the new reference
      actions.setIncludeStyleReferences(true);
      if (data.imageUrl) {
        actions.addStyleReference(data.imageUrl);
      }
      return;
    }

    // Handle snapshot drop to style references: upload blob then add URL
    if (overId === DROP_ZONE_IDS.STYLE_REFERENCES && data.type === "snapshot" && data.blob) {
      actions.setIncludeStyleReferences(true);
      actions.addStyleReferenceFromBlob(data.blob);
      actions.closeSnapshotViewModal();
      return;
    }

    // Handle drop on chat input: add as attachment for chat reference (style, face, thumbnail, snapshot only)
    if (overId === DROP_ZONE_IDS.CHAT_INPUT) {
      const handler = chatDropHandlerRef?.current;
      if (!handler) return;
      if (data.type === "style") {
        const item = data.item as DbStyle | PublicStyle;
        const imageUrl = item.preview_thumbnail_url;
        if (imageUrl) handler({ type: "style", imageUrl });
      } else if (data.type === "face") {
        const item = data.item as DbFace;
        const imageUrl = item.image_urls?.[0];
        if (imageUrl) handler({ type: "face", imageUrl });
      } else if (data.type === "thumbnail") {
        const item = data.item as Thumbnail;
        const imageUrl = data.imageUrl ?? item.imageUrl;
        if (imageUrl) handler({ type: "thumbnail", imageUrl });
      } else if (data.type === "snapshot" && data.blob) {
        handler({ type: "snapshot", blob: data.blob });
      }
      return;
    }
  }, [actions, chatDropHandlerRef]);

  /**
   * Handle drag cancel - clear active data
   */
  const handleDragCancel = useCallback(() => {
    setActiveData(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      
      {/* Drag overlay renders above everything */}
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
      }}>
        {activeData ? (
          <DragOverlayPreview
            type={activeData.type}
            item={activeData.item}
            imageUrl={activeData.imageUrl}
            imageBlobUrl={activeData.imageBlobUrl}
            characterName={activeData.characterName}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default StudioDndContext;
