"use client";

/**
 * ThumbnailEditModal Component
 * 
 * A modal for editing and regenerating thumbnails.
 * Allows users to modify the title and add custom instructions.
 * Regeneration creates a NEW thumbnail (does not replace the original).
 */

import React, { useState, useEffect } from "react";
import { Sparkles, Info } from "lucide-react";
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
import type { Thumbnail } from "@/lib/types/database";
import { emitTourEvent } from "@/tourkit/app/tourEvents.browser";

export interface ThumbnailEditData {
  title: string;
  customPrompt: string;
}

export interface ThumbnailEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thumbnail: Thumbnail | null;
  onRegenerate: (data: ThumbnailEditData) => void;
  isRegenerating?: boolean;
}

export function ThumbnailEditModal({
  open,
  onOpenChange,
  thumbnail,
  onRegenerate,
  isRegenerating = false,
}: ThumbnailEditModalProps) {
  const [title, setTitle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const { hasWatermark } = useSubscription();
  const previewImageUrl = (thumbnail?.thumbnail800wUrl || thumbnail?.imageUrl) ?? null;
  const { url: watermarkedUrl } = useWatermarkedImage(previewImageUrl, {
    enabled: hasWatermark() && !!thumbnail,
  });
  const displaySrc = watermarkedUrl ?? previewImageUrl ?? undefined;

  // Reset form when thumbnail changes or modal opens
  useEffect(() => {
    if (open) {
      emitTourEvent("tour.event.modal.opened", { modalKey: "thumbnailEdit" });
    } else {
      emitTourEvent("tour.event.modal.closed", { modalKey: "thumbnailEdit" });
    }

    if (thumbnail && open) {
      setTitle(thumbnail.name || "");
      setCustomPrompt("");
    }
  }, [thumbnail, open]);

  if (!thumbnail) return null;

  const handleRegenerate = () => {
    onRegenerate({
      title: title.trim() || thumbnail.name,
      customPrompt: customPrompt.trim(),
    });
  };

  const handleCancel = () => {
    if (!isRegenerating) {
      onOpenChange(false);
    }
  };

  const hasChanges = title.trim() !== thumbnail.name || customPrompt.trim() !== "";

  return (
    <Modal open={open} onOpenChange={isRegenerating ? undefined : onOpenChange}>
      <ModalContent size="lg" showCloseButton={!isRegenerating}>
        <ModalHeader>
          <ModalTitle>Edit Thumbnail</ModalTitle>
          <ModalDescription>
            Modify the title and add custom instructions to regenerate this thumbnail.
          </ModalDescription>
        </ModalHeader>

        <ModalBody className="gap-6">
          {/* Current Thumbnail Preview */}
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

          {/* Title Field */}
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

          {/* Custom Instructions Field */}
          <div className="space-y-2">
            <label
              htmlFor="custom-prompt"
              className="text-sm font-medium leading-none"
            >
              Custom Instructions
              <span className="ml-1 text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Add any custom instructions for regenerating this thumbnail..."
              disabled={isRegenerating}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Describe any changes you want to make to the thumbnail. Be specific about colors, style, composition, or elements you want to add or remove.
            </p>
          </div>

          {/* Info Note */}
          <div className={cn(
            "flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3",
            "dark:border-blue-900 dark:bg-blue-950/50"
          )}>
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Regenerating will create a <strong>new thumbnail</strong> based on your instructions. 
              The original thumbnail will be kept and not replaced.
            </p>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isRegenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
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
      </ModalContent>
    </Modal>
  );
}

export default ThumbnailEditModal;
