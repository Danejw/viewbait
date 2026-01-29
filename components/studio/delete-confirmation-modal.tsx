"use client";

/**
 * DeleteConfirmationModal Component
 * 
 * A confirmation modal to prevent accidental thumbnail deletions.
 * Shows a preview of the thumbnail and requires explicit user confirmation.
 */

import React from "react";
import { AlertTriangle } from "lucide-react";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useWatermarkedImage } from "@/lib/hooks/useWatermarkedImage";
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
import type { Thumbnail } from "@/lib/types/database";

export interface DeleteConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thumbnail: Thumbnail | null;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function DeleteConfirmationModal({
  open,
  onOpenChange,
  thumbnail,
  onConfirm,
  isDeleting = false,
}: DeleteConfirmationModalProps) {
  const { hasWatermark } = useSubscription();
  const previewImageUrl = (thumbnail?.thumbnail400wUrl || thumbnail?.imageUrl) ?? null;
  const { url: watermarkedUrl } = useWatermarkedImage(previewImageUrl, {
    enabled: hasWatermark() && !!thumbnail,
  });
  const displaySrc = watermarkedUrl ?? previewImageUrl ?? undefined;

  if (!thumbnail) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    if (!isDeleting) {
      onOpenChange(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={isDeleting ? undefined : onOpenChange}>
      <ModalContent size="sm" showCloseButton={!isDeleting}>
        <ModalHeader>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <ModalTitle className="text-center">Delete Thumbnail?</ModalTitle>
          <ModalDescription className="text-center">
            This action cannot be undone.
          </ModalDescription>
        </ModalHeader>

        <ModalBody>
          {/* Thumbnail Preview */}
          <div className="mx-auto w-full max-w-[200px] overflow-hidden rounded-lg border">
            <div className="relative aspect-video bg-muted">
              <img
                src={displaySrc ?? thumbnail.thumbnail400wUrl ?? thumbnail.imageUrl}
                alt={thumbnail.name}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          
          {/* Thumbnail Name */}
          <p className="text-center text-sm font-medium text-muted-foreground truncate">
            {thumbnail.name}
          </p>
        </ModalBody>

        <ModalFooter className="sm:justify-center">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <ViewBaitLogo className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default DeleteConfirmationModal;
