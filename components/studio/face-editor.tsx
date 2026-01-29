"use client";

/**
 * FaceEditor Component
 * 
 * Modal dialog for creating and editing faces.
 * Supports name input and up to 3 reference images via drag-and-drop or file picker.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { User, ImagePlus, X, Upload } from "lucide-react";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DbFace } from "@/lib/types/database";

const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface FaceEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  face?: DbFace | null; // null = create mode, DbFace = edit mode
  onSave: (name: string, images: File[], existingUrls: string[]) => Promise<void>;
  isLoading?: boolean;
}

interface ImagePreview {
  id: string;
  url: string;
  file?: File;
  isExisting: boolean;
}

/**
 * Image preview with remove button
 */
function ImagePreviewItem({
  preview,
  onRemove,
  isRemoving,
}: {
  preview: ImagePreview;
  onRemove: (id: string) => void;
  isRemoving?: boolean;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative group">
      <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-muted">
        {!isLoaded && <Skeleton className="absolute inset-0 h-full w-full" />}
        <img
          src={preview.url}
          alt="Face reference"
          onLoad={() => setIsLoaded(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
        />
        {isRemoving && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <ViewBaitLogo className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="destructive"
        size="icon-xs"
        onClick={() => onRemove(preview.id)}
        disabled={isRemoving}
        className={cn(
          "absolute -right-2 -top-2 h-6 w-6 rounded-full shadow-sm",
          "opacity-0 transition-opacity group-hover:opacity-100",
          isRemoving && "opacity-100"
        )}
        aria-label="Remove face"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

/**
 * Drop zone for image uploads
 */
function DropZone({
  onFilesAdded,
  disabled,
  remainingSlots,
}: {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
  remainingSlots: number;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files).filter(
        (file) => file.type.startsWith("image/") && file.size <= MAX_FILE_SIZE
      );
      if (files.length > 0) {
        onFilesAdded(files.slice(0, remainingSlots));
      }
    },
    [disabled, onFilesAdded, remainingSlots]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter(
        (file) => file.type.startsWith("image/") && file.size <= MAX_FILE_SIZE
      );
      if (files.length > 0) {
        onFilesAdded(files.slice(0, remainingSlots));
      }
      // Reset input
      e.target.value = "";
    },
    [onFilesAdded, remainingSlots]
  );

  if (remainingSlots <= 0) {
    return null;
  }

  return (
    <Button
      asChild
      type="button"
      variant="outline"
      className={cn(
        "flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 h-auto border-2 border-dashed rounded-lg",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-50"
      )}
      onClick={handleClick}
      disabled={disabled}
    >
      <div
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleClick();
          }
        }}
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground text-center px-1">
          Add Image
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </Button>
  );
}

export function FaceEditor({
  open,
  onOpenChange,
  face,
  onSave,
  isLoading = false,
}: FaceEditorProps) {
  const isEditMode = !!face;
  const [name, setName] = useState("");
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize state when face changes or dialog opens
  useEffect(() => {
    if (open) {
      if (face) {
        setName(face.name);
        setImages(
          (face.image_urls || []).map((url, index) => ({
            id: `existing-${index}`,
            url,
            isExisting: true,
          }))
        );
      } else {
        setName("");
        setImages([]);
      }
      setError(null);
    }
  }, [open, face]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (!img.isExisting && img.url.startsWith("blob:")) {
          URL.revokeObjectURL(img.url);
        }
      });
    };
  }, [images]);

  const handleFilesAdded = useCallback((files: File[]) => {
    setError(null);
    const newPreviews: ImagePreview[] = files.map((file, index) => ({
      id: `new-${Date.now()}-${index}`,
      url: URL.createObjectURL(file),
      file,
      isExisting: false,
    }));

    setImages((prev) => {
      const combined = [...prev, ...newPreviews];
      // Limit to MAX_IMAGES
      if (combined.length > MAX_IMAGES) {
        // Revoke URLs of images that won't be added
        combined.slice(MAX_IMAGES).forEach((img) => {
          if (!img.isExisting && img.url.startsWith("blob:")) {
            URL.revokeObjectURL(img.url);
          }
        });
        return combined.slice(0, MAX_IMAGES);
      }
      return combined;
    });
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img && !img.isExisting && img.url.startsWith("blob:")) {
        URL.revokeObjectURL(img.url);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const newFiles = images
        .filter((img) => !img.isExisting && img.file)
        .map((img) => img.file!);
      const existingUrls = images
        .filter((img) => img.isExisting)
        .map((img) => img.url);

      await onSave(trimmedName, newFiles, existingUrls);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save face");
    } finally {
      setIsSaving(false);
    }
  }, [name, images, onSave, onOpenChange]);

  const remainingSlots = MAX_IMAGES - images.length;
  const canSave = name.trim().length > 0 && !isSaving && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEditMode ? "Edit Face" : "Add New Face"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the name or reference images for this face."
              : "Add a name and up to 3 reference images for better facial consistency in generated thumbnails."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="face-name">Name</Label>
            <Input
              id="face-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., John, Sarah, Me"
              disabled={isSaving || isLoading}
              autoFocus
            />
          </div>

          {/* Reference images */}
          <div className="space-y-2">
            <Label>Reference Images ({images.length}/{MAX_IMAGES})</Label>
            <p className="text-xs text-muted-foreground">
              Add up to 3 clear face photos for better consistency. Different angles work best.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {images.map((preview) => (
                <ImagePreviewItem
                  key={preview.id}
                  preview={preview}
                  onRemove={handleRemoveImage}
                  isRemoving={isSaving || isLoading}
                />
              ))}
              <DropZone
                onFilesAdded={handleFilesAdded}
                disabled={isSaving || isLoading}
                remainingSlots={remainingSlots}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving || isLoading ? (
              <>
                <ViewBaitLogo className="mr-2 h-4 w-4 animate-spin" />
                {isEditMode ? "Saving..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              "Create Face"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FaceEditor;
