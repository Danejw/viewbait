"use client";

/**
 * DragOverlayPreview Component
 * 
 * Renders a miniature preview of the dragged item that follows the cursor.
 * Supports styles, palettes, faces, and thumbnails with appropriate visual representations.
 * 
 * Design:
 * - Slightly scaled up (1.05x) for emphasis
 * - Drop shadow for depth
 * - Semi-transparent to show what's underneath
 * - Matches the visual style of the source card
 */

import React from "react";
import { Palette, User, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { PaletteColorStrip } from "./palette-thumbnail-card";
import type { DragItemType } from "./studio-dnd-context";
import type { DbStyle, DbPalette, DbFace, PublicStyle, PublicPalette, Thumbnail } from "@/lib/types/database";

interface DragOverlayPreviewProps {
  type: DragItemType;
  item: DbStyle | DbPalette | DbFace | PublicStyle | PublicPalette | Thumbnail;
  /** Image URL for thumbnails */
  imageUrl?: string;
}

/**
 * Type guard for style items
 */
function isStyle(item: any): item is DbStyle | PublicStyle {
  return "preview_thumbnail_url" in item || "description" in item;
}

/**
 * Type guard for palette items
 */
function isPalette(item: any): item is DbPalette | PublicPalette {
  return "colors" in item && Array.isArray(item.colors);
}

/**
 * Type guard for face items
 */
function isFace(item: any): item is DbFace {
  return "image_urls" in item && Array.isArray(item.image_urls);
}

/**
 * Type guard for thumbnail items
 */
function isThumbnail(item: any): item is Thumbnail {
  return "imageUrl" in item && "name" in item && !("preview_thumbnail_url" in item);
}

/**
 * Style preview - shows thumbnail image
 */
function StylePreview({ item }: { item: DbStyle | PublicStyle }) {
  const imageUrl = item.preview_thumbnail_url;
  
  return (
    <div className="relative aspect-video w-32 overflow-hidden rounded-lg bg-muted shadow-xl">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Palette className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      {/* Name overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="truncate text-xs font-medium text-white">{item.name}</p>
      </div>
    </div>
  );
}

/**
 * Palette preview - shows color strip
 */
function PalettePreview({ item }: { item: DbPalette | PublicPalette }) {
  return (
    <div className="w-32 overflow-hidden rounded-lg bg-muted shadow-xl">
      <PaletteColorStrip colors={item.colors} heightClass="h-12" rounded="rounded-t-lg" />
      {/* Name below colors */}
      <div className="bg-card/90 px-2 py-1.5">
        <p className="truncate text-xs font-medium">{item.name}</p>
      </div>
    </div>
  );
}

/**
 * Face preview - shows face image
 */
function FacePreview({ item }: { item: DbFace }) {
  const imageUrl = item.image_urls?.[0];
  
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-muted shadow-xl">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <User className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

/**
 * Thumbnail preview - shows thumbnail image
 * Used when dragging thumbnails to style references
 */
function ThumbnailPreview({ item, imageUrl }: { item: Thumbnail; imageUrl?: string }) {
  const src = imageUrl || item.imageUrl;
  
  return (
    <div className="relative aspect-video w-32 overflow-hidden rounded-lg bg-muted shadow-xl">
      {src ? (
        <img
          src={src}
          alt={item.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Image className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      {/* Name overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="truncate text-xs font-medium text-white">{item.name}</p>
      </div>
    </div>
  );
}

/**
 * Main DragOverlayPreview component
 * Renders the appropriate preview based on item type
 */
export function DragOverlayPreview({ type, item, imageUrl }: DragOverlayPreviewProps) {
  return (
    <div
      className={cn(
        "pointer-events-none",
        "scale-105 opacity-90",
        "transition-transform duration-150"
      )}
    >
      {type === "style" && isStyle(item) && <StylePreview item={item} />}
      {type === "palette" && isPalette(item) && <PalettePreview item={item} />}
      {type === "face" && isFace(item) && <FacePreview item={item} />}
      {type === "thumbnail" && isThumbnail(item) && <ThumbnailPreview item={item} imageUrl={imageUrl} />}
    </div>
  );
}

export default DragOverlayPreview;
