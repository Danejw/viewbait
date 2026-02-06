"use client";

/**
 * SetOnYouTubeModal
 *
 * Modal to pick a YouTube video (from recent uploads or paste video ID/URL) and set
 * a ViewBait thumbnail as that video's thumbnail. Uses the same set-thumbnail API
 * and error handling as SetThumbnailPicker.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setVideoThumbnail } from "@/lib/services/youtube-set-thumbnail";
import { useYouTubeIntegration } from "@/lib/hooks/useYouTubeIntegration";
import { parseYouTubeVideoId } from "@/lib/utils/youtube";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface SetOnYouTubeModalProps {
  thumbnailId: string;
  thumbnailName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface YouTubeVideoItem {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount?: number;
  likeCount?: number;
}

export function SetOnYouTubeModal({
  thumbnailId,
  thumbnailName,
  open,
  onOpenChange,
  onSuccess,
}: SetOnYouTubeModalProps) {
  const { reconnect } = useYouTubeIntegration();
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [pasteInput, setPasteInput] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchVideos = useCallback(async () => {
    setVideosLoading(true);
    setVideosError(null);
    try {
      const response = await fetch("/api/youtube/videos");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch videos");
      }
      setVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch (err) {
      setVideosError(err instanceof Error ? err.message : "Failed to load videos");
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedVideoId(null);
      setPasteInput("");
      fetchVideos();
    }
  }, [open, fetchVideos]);

  const resolvedVideoId =
    selectedVideoId ||
    (pasteInput.trim() ? parseYouTubeVideoId(pasteInput.trim()) : null);
  const canConfirm = !!resolvedVideoId;

  const handleConfirm = useCallback(async () => {
    if (!resolvedVideoId) return;
    setLoading(true);
    try {
      const result = await setVideoThumbnail(resolvedVideoId, {
        thumbnail_id: thumbnailId,
      });
      if (result.success) {
        toast.success("Thumbnail updated on YouTube.");
        onOpenChange(false);
        onSuccess?.();
      } else {
        if (result.code === "SCOPE_REQUIRED") {
          const description = result.redirect_uri_hint
            ? `Add this URL to Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs, then click Reconnect:\n${result.redirect_uri_hint}`
            : undefined;
          toast.error(
            "Thumbnail upload requires extra permission. Reconnect your YouTube account (or add the redirect URI to GCP).",
            {
              description,
              action: {
                label: "Reconnect",
                onClick: () => reconnect(),
              },
            }
          );
        } else if (result.code === "TIER_REQUIRED") {
          toast.error("YouTube integration is available on the Pro plan.");
        } else if (result.code === "NOT_CONNECTED") {
          toast.error(
            "YouTube not connected. Connect your account in the YouTube tab."
          );
        } else {
          toast.error(result.error || "Failed to set thumbnail");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [resolvedVideoId, thumbnailId, onOpenChange, onSuccess, reconnect]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setSelectedVideoId(null);
        setPasteInput("");
      }
      onOpenChange(next);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "z-[10003] flex max-h-[90vh] w-[90vw] max-w-lg flex-col gap-4 p-6"
        )}
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle id="set-on-youtube-dialog-title">
            Set thumbnail on YouTube
          </DialogTitle>
        </DialogHeader>
        {thumbnailName && (
          <p className="text-sm text-muted-foreground">
            Use &quot;{thumbnailName}&quot; as the thumbnail for a video.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">Video ID or URL</label>
          <Input
            placeholder="Paste video ID or youtube.com/watch?v=..."
            value={pasteInput}
            onChange={(e) => {
              setPasteInput(e.target.value);
              if (selectedVideoId) setSelectedVideoId(null);
            }}
            className="font-mono text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Or pick a recent video</label>
          {videosLoading ? (
            <p className="text-sm text-muted-foreground">Loading your videos…</p>
          ) : videosError ? (
            <p className="text-sm text-destructive">{videosError}</p>
          ) : videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No videos found. Paste a video ID or URL above.
            </p>
          ) : (
            <div
              className="max-h-48 overflow-y-auto hide-scrollbar rounded-lg border p-2 space-y-1"
              role="listbox"
              aria-label="Your recent videos"
            >
              {videos.slice(0, 20).map((v) => (
                <button
                  key={v.videoId}
                  type="button"
                  role="option"
                  aria-selected={selectedVideoId === v.videoId}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors",
                    selectedVideoId === v.videoId
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:bg-muted/60"
                  )}
                  onClick={() => {
                    setSelectedVideoId(v.videoId);
                    setPasteInput("");
                  }}
                >
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    className="h-12 w-20 shrink-0 rounded object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {v.title || v.videoId}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
          >
            {loading ? "Setting…" : "Set thumbnail"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
