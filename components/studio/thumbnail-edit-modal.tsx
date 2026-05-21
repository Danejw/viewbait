"use client";

/**
 * ThumbnailEditModal Component
 *
 * A modal for editing and regenerating thumbnails.
 * Allows users to modify the title, add custom instructions, and attach reference images.
 * Regeneration creates a NEW thumbnail (does not replace the original).
 */

import React, { useState, useRef, useCallback } from "react";
import { Sparkles, Info, ImagePlus } from "lucide-react";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { CRTLoadingEffect } from "@/components/ui/crt-loading-effect";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useWatermarkedImage } from "@/lib/hooks/useWatermarkedImage";
import {
  useReferenceImageUpload,
  MAX_REFERENCE_IMAGES,
} from "@/lib/hooks/useReferenceImageUpload";
import { ReferenceImageChips } from "@/components/studio/reference-image-chips";
import type { Thumbnail } from "@/lib/types/database";

export interface ThumbnailEditData {
  title: string;
  customPrompt: string;
  referenceImageUrls?: string[];
}

export interface ThumbnailEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thumbnail: Thumbnail | null;
  onRegenerate: (data: ThumbnailEditData) => void;
  isRegenerating?: boolean;
}

interface ThumbnailEditFormProps {
  thumbnail: Thumbnail;
  onRegenerate: (data: ThumbnailEditData) => void;
  isRegenerating: boolean;
  onCancel: () => void;
}

function ThumbnailEditForm({
  thumbnail,
  onRegenerate,
  isRegenerating,
  onCancel,
}: ThumbnailEditFormProps) {
  const [title, setTitle] = useState(thumbnail.name || "");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    entries: referenceEntries,
    urls: referenceImageUrls,
    isUploading,
    error: uploadError,
    hasRoom,
    addFiles,
    removeAt: removeReferenceAt,
    handlePaste,
    handleDrop,
  } = useReferenceImageUpload();

  const { hasWatermark } = useSubscription();
  const previewImageUrl = (thumbnail.thumbnail800wUrl || thumbnail.imageUrl) ?? null;
  const { url: watermarkedUrl } = useWatermarkedImage(previewImageUrl, {
    enabled: hasWatermark(),
  });
  const displaySrc = watermarkedUrl ?? previewImageUrl ?? undefined;

  const handleRegenerate = () => {
    onRegenerate({
      title: title.trim() || thumbnail.name,
      customPrompt: customPrompt.trim(),
      referenceImageUrls:
        referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
    });
  };

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (isRegenerating || isUploading) return;
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        setIsDraggingFile(true);
      }
    },
    [isRegenerating, isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDropWrapped = useCallback(
    (e: React.DragEvent) => {
      setIsDraggingFile(false);
      if (isRegenerating || isUploading) return;
      handleDrop(e);
    },
    [isRegenerating, isUploading, handleDrop]
  );

  const instructionsDisabled = isRegenerating || isUploading;

  return (
    <>
      <ModalBody className="gap-6">
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border bg-muted">
          <div className="relative aspect-video">
            {isRegenerating ? (
              <CRTLoadingEffect className="absolute inset-0 h-full w-full !aspect-auto rounded-lg" />
            ) : (
              <img
                src={displaySrc ?? thumbnail.thumbnail800wUrl ?? thumbnail.imageUrl}
                alt={thumbnail.name}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="thumbnail-title"
            className="text-sm font-medium leading-none"
          >
            Title
          </label>
          <Input
            id="thumbnail-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter thumbnail title"
            disabled={isRegenerating}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="custom-prompt"
              className="text-sm font-medium leading-none"
            >
              Custom Instructions
              <span className="ml-1 font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            {hasRoom && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                  disabled={instructionsDisabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5"
                  disabled={instructionsDisabled}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Add image
                </Button>
              </>
            )}
          </div>

          <div
            className={cn(
              "space-y-2 rounded-lg border border-border p-3 transition-colors",
              isDraggingFile && "border-primary bg-primary/5",
              instructionsDisabled && "opacity-70"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropWrapped}
            onPaste={handlePaste}
          >
            <ReferenceImageChips
              entries={referenceEntries}
              onRemove={removeReferenceAt}
              disabled={instructionsDisabled}
            />

            <Textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Add any custom instructions for regenerating this thumbnail..."
              disabled={instructionsDisabled}
              className="min-h-[100px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />

            {isUploading && (
              <p className="text-xs text-muted-foreground">Uploading reference image…</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Describe changes to the thumbnail. Paste, drag, or upload up to{" "}
            {MAX_REFERENCE_IMAGES} reference images (e.g. a product or logo) and
            explain how to use them.
          </p>
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
        </div>

        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3",
            "dark:border-blue-900 dark:bg-blue-950/50"
          )}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Regenerating will create a <strong>new thumbnail</strong> based on your
            instructions. The original thumbnail will be kept and not replaced.
          </p>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onCancel} disabled={isRegenerating}>
          Cancel
        </Button>
        <Button onClick={handleRegenerate} disabled={isRegenerating || isUploading}>
          {isRegenerating ? (
            <>
              <ViewBaitLogo variant="white" className="mr-2 h-4 w-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Regenerate
            </>
          )}
        </Button>
      </ModalFooter>
    </>
  );
}

export function ThumbnailEditModal({
  open,
  onOpenChange,
  thumbnail,
  onRegenerate,
  isRegenerating = false,
}: ThumbnailEditModalProps) {
  const handleCancel = () => {
    if (!isRegenerating) {
      onOpenChange(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={isRegenerating ? undefined : onOpenChange}>
      <ModalContent size="lg" showCloseButton={!isRegenerating}>
        <ModalHeader>
          <ModalTitle>Edit Thumbnail</ModalTitle>
          <ModalDescription>
            Modify the title and add custom instructions to regenerate this thumbnail.
          </ModalDescription>
        </ModalHeader>

        {thumbnail && open ? (
          <ThumbnailEditForm
            key={thumbnail.id}
            thumbnail={thumbnail}
            onRegenerate={onRegenerate}
            isRegenerating={isRegenerating}
            onCancel={handleCancel}
          />
        ) : (
          <ModalBody />
        )}
      </ModalContent>
    </Modal>
  );
}

export default ThumbnailEditModal;
