"use client";

/**
 * ThumbnailCommentDialog – Dialog for adding comments to thumbnails in shared galleries.
 * Allows users to input feedback about why they like/dislike a thumbnail.
 */

import React, { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export interface ThumbnailCommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thumbnailTitle: string;
  onCommentAdded?: () => void;
  /** Function to call when comment is submitted */
  onSubmit: (comment: string) => Promise<{ comments: Array<{ user_id: string | null; comment: string; created_at: string }> | null; error: Error | null }>;
}

export function ThumbnailCommentDialog({
  open,
  onOpenChange,
  thumbnailTitle,
  onCommentAdded,
  onSubmit,
}: ThumbnailCommentDialogProps) {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      toast.error("Please enter a comment");
      return;
    }

    if (trimmedComment.length > 2000) {
      toast.error("Comment must be 2000 characters or less");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit(trimmedComment);
      if (result.error) {
        toast.error(result.error.message || "Failed to add comment");
      } else {
        toast.success("Comment added successfully");
        setComment("");
        onOpenChange(false);
        onCommentAdded?.();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setComment("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Add Comment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Share your thoughts about <span className="font-medium">{thumbnailTitle}</span>
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Why do you like it? What would you change? What stands out to you?
            </p>
            <Textarea
              placeholder="Enter your comment here..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmitting}
              maxLength={2000}
              rows={6}
              className="resize-none"
            />
            <div className="mt-1 text-xs text-muted-foreground text-right">
              {comment.length} / 2000
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !comment.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Comment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
