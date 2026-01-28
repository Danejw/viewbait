"use client";

/**
 * FaceThumbnail Component
 *
 * Reusable face thumbnail matching ThumbnailCard visual design:
 * - Card with tight container fit, overflow-hidden, aspect-video
 * - Hover: scale 105%, ring, shadow; overlay with icon buttons
 * - If user owns the face: edit and delete icon buttons
 * - Click opens modal with larger view (ImageModal via onView)
 * - Optional compact variant for generator strip; optional onSelect for selection
 *
 * @see thumbnail-card.tsx for styling reference
 * @see style-thumbnail-card.tsx for ownership/action pattern
 */

import React, { memo, useCallback, useState } from "react";
import { Pencil, Trash2, User, Expand, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DbFace } from "@/lib/types/database";

/**
 * Skeleton for face thumbnail - card style (matches ThumbnailCard skeleton)
 */
export function FaceThumbnailSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-3 w-10" />
      </div>
    );
  }
  return (
    <Card className="group relative overflow-hidden p-0">
      <div className="relative aspect-video w-full">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </Card>
  );
}

export interface FaceThumbnailProps {
  face: DbFace;
  /** Current user ID for ownership (edit/delete only for owner) */
  currentUserId?: string | null;
  /** Variant: card (grid) or compact (generator strip) */
  variant?: "card" | "compact";
  /** Click opens larger view modal */
  onView?: (face: DbFace) => void;
  onEdit?: (face: DbFace) => void;
  onDelete?: (id: string) => void;
  /** For generator: toggle selection; show check button when provided */
  onSelect?: (faceId: string) => void;
  isSelected?: boolean;
}

/**
 * Action button with tooltip (matches thumbnail-card pattern)
 */
function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  active = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: "default" | "destructive";
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClick}
          className={cn(
            "h-7 w-7 bg-muted/80 hover:bg-muted",
            variant === "destructive" && "hover:bg-destructive/20 hover:text-destructive",
            active && "text-primary"
          )}
        >
          <Icon className={cn("h-4 w-4", active && "fill-primary")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Memoized FaceThumbnail – visual styling and behavior aligned with ThumbnailCard
 */
export const FaceThumbnail = memo(function FaceThumbnail({
  face,
  currentUserId,
  variant = "card",
  onView,
  onEdit,
  onDelete,
  onSelect,
  isSelected = false,
}: FaceThumbnailProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const firstImage = face.image_urls?.[0];
  const isOwner = Boolean(currentUserId && face.user_id && currentUserId === face.user_id);

  const handleClick = useCallback(() => {
    onView?.(face);
  }, [face, onView]);

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit?.(face);
    },
    [face, onEdit]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(face.id);
    },
    [face.id, onDelete]
  );

  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect?.(face.id);
    },
    [face.id, onSelect]
  );

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-1 rounded-md p-0.5 transition-all",
          isSelected && "ring-2 ring-primary ring-offset-2 rounded-md"
        )}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
          className={cn(
            "group relative h-14 w-14 overflow-hidden rounded-full border-2 transition-all",
            "cursor-pointer transition-transform duration-300 hover:scale-105",
            "hover:ring-2 hover:ring-primary/50 hover:shadow-lg",
            isSelected ? "border-primary" : "border-border hover:border-primary/50"
          )}
        >
          {firstImage ? (
            <>
              {!imageLoaded && (
                <Skeleton className="absolute inset-0 h-full w-full rounded-full" />
              )}
              <img
                src={firstImage}
                alt={face.name}
                onLoad={handleImageLoad}
                loading="lazy"
                decoding="async"
                className={cn(
                  "h-full w-full object-cover transition-opacity duration-200",
                  imageLoaded ? "opacity-100" : "opacity-0"
                )}
              />
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center gap-0.5",
                  "bg-gradient-to-t from-black/60 via-black/30 to-transparent",
                  "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                )}
              >
                <ActionButton
                  icon={Expand}
                  label="View"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick();
                  }}
                />
                {onSelect && (
                  <ActionButton
                    icon={Check}
                    label={isSelected ? "Deselect" : "Select for generation"}
                    onClick={handleSelect}
                    active={isSelected}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <span className="max-w-14 truncate text-xs text-muted-foreground">
          {face.name}
        </span>
      </div>
    );
  }

  // Card variant (faces tab grid)
  return (
    <Card
      className={cn(
        "group relative aspect-video w-full cursor-pointer overflow-hidden p-0 transition-all",
        "hover:ring-2 hover:ring-primary/50 hover:shadow-lg"
      )}
      onClick={handleClick}
    >
      <div className="relative h-full w-full overflow-hidden bg-muted">
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
          {!imageLoaded && firstImage && (
            <Skeleton className="absolute inset-0 h-full w-full" />
          )}
          {firstImage ? (
            <img
              src={firstImage}
              alt={face.name}
              onLoad={handleImageLoad}
              loading="lazy"
              decoding="async"
              className={cn(
                "h-full w-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <User className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Top overlay – name, shown on hover */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex items-start justify-between p-2",
            "bg-gradient-to-b from-black/60 to-transparent",
            "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          )}
        >
          <p className="max-w-[85%] truncate text-sm font-medium text-white drop-shadow-sm">
            {face.name}
          </p>
        </div>

        {/* Action bar – bottom overlay, shown on hover */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 p-2",
            "bg-gradient-to-t from-black/60 via-black/40 to-transparent",
            "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          )}
        >
          <ActionButton
            icon={Expand}
            label="View"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          />
          {isOwner && onEdit && (
            <ActionButton icon={Pencil} label="Edit" onClick={handleEdit} />
          )}
          {isOwner && onDelete && (
            <ActionButton
              icon={Trash2}
              label="Delete"
              onClick={handleDelete}
              variant="destructive"
            />
          )}
        </div>
      </div>
    </Card>
  );
});

export default FaceThumbnail;
