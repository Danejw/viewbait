"use client";

/**
 * FaceCard Component
 * 
 * Displays a face with its reference images (up to 3).
 * Supports selection state for the generator and edit/delete actions.
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useCallback, useState } from "react";
import { Pencil, Trash2, MoreHorizontal, User, ImagePlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DbFace } from "@/lib/types/database";

export interface FaceCardProps {
  face: DbFace;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onEdit?: (face: DbFace) => void;
  onDelete?: (id: string) => void;
  onAddImage?: (face: DbFace) => void;
  showActions?: boolean;
  compact?: boolean;
}

/**
 * Skeleton card for loading state
 */
export function FaceCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-3 w-12" />
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-16 w-16 rounded-md" />
          <Skeleton className="h-16 w-16 rounded-md" />
          <Skeleton className="h-16 w-16 rounded-md" />
        </div>
      </div>
    </Card>
  );
}

/**
 * Face image thumbnail with loading state
 */
const FaceImage = memo(function FaceImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted",
          className
        )}
      >
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {!isLoaded && <Skeleton className="absolute inset-0 h-full w-full" />}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        loading="lazy"
        decoding="async"
        className={cn(
          "h-full w-full object-cover transition-opacity duration-200",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
});

/**
 * Compact face card for generator selection
 */
export const FaceCardCompact = memo(function FaceCardCompact({
  face,
  isSelected,
  onSelect,
}: Pick<FaceCardProps, "face" | "isSelected" | "onSelect">) {
  const handleClick = useCallback(() => {
    onSelect?.(face.id);
  }, [face.id, onSelect]);

  const firstImage = face.image_urls?.[0];

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-md p-1 transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <div
        className={cn(
          "h-12 w-12 overflow-hidden rounded-full border-2 transition-all",
          isSelected
            ? "border-primary"
            : "border-border hover:border-primary/50"
        )}
      >
        {firstImage ? (
          <FaceImage src={firstImage} alt={face.name} className="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <span className="max-w-14 truncate text-xs text-muted-foreground">
        {face.name}
      </span>
    </button>
  );
});

/**
 * Full face card for "My Faces" view
 */
export const FaceCard = memo(function FaceCard({
  face,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onAddImage,
  showActions = true,
}: FaceCardProps) {
  const handleSelect = useCallback(() => {
    onSelect?.(face.id);
  }, [face.id, onSelect]);

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

  const handleAddImage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAddImage?.(face);
    },
    [face, onAddImage]
  );

  const imageCount = face.image_urls?.length || 0;
  const canAddMore = imageCount < 3;

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden transition-all",
        "hover:ring-2 hover:ring-primary/50 hover:shadow-lg",
        isSelected && "ring-2 ring-primary shadow-lg"
      )}
      onClick={handleSelect}
    >
      <div className="p-4">
        {/* Header with name and actions */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium truncate max-w-[150px]">{face.name}</h3>
          </div>
          
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {canAddMore && (
                  <DropdownMenuItem onClick={handleAddImage}>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Add Image
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Reference images grid */}
        <div className="flex gap-2">
          {/* Show existing images */}
          {face.image_urls?.map((url, index) => (
            <FaceImage
              key={`${face.id}-${index}`}
              src={url}
              alt={`${face.name} reference ${index + 1}`}
              className="h-16 w-16 rounded-md"
            />
          ))}

          {/* Empty slots for remaining images */}
          {Array.from({ length: Math.max(0, 3 - imageCount) }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-md border-2 border-dashed",
                "border-border text-muted-foreground",
                canAddMore && showActions && "hover:border-primary/50 hover:text-primary/50 transition-colors"
              )}
              onClick={canAddMore && showActions ? handleAddImage : undefined}
            >
              {canAddMore && showActions && index === 0 ? (
                <ImagePlus className="h-5 w-5" />
              ) : (
                <User className="h-5 w-5 opacity-30" />
              )}
            </div>
          ))}
        </div>

        {/* Image count indicator */}
        <p className="mt-2 text-xs text-muted-foreground">
          {imageCount}/3 reference images
        </p>
      </div>
    </Card>
  );
});

export default FaceCard;
