"use client";

/**
 * useYouTubeStyleExtract
 *
 * Reusable hook for selecting 2–10 YouTube videos and extracting a common style
 * from their thumbnails (same API as My channel and Import by URL).
 * Returns selection state, extract action, and error. Caller opens StyleEditor on success.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useStyles } from "@/lib/hooks/useStyles";
import { useAuth } from "@/lib/hooks/useAuth";
import type { DbStyle } from "@/lib/types/database";

export interface YouTubeStyleExtractVideo {
  videoId: string;
  thumbnailUrl: string;
}

export interface UseYouTubeStyleExtractReturn {
  selectedVideoIds: Set<string>;
  toggleSelectVideo: (videoId: string) => void;
  canExtract: boolean;
  handleExtractStyle: () => Promise<DbStyle | null>;
  isExtracting: boolean;
  extractError: string | null;
  clearExtractError: () => void;
}

const MIN_SELECT = 2;
const MAX_SELECT = 10;
const DEFAULT_ERROR = "Failed to extract style. Try again or select different thumbnails.";

export function useYouTubeStyleExtract(
  videos: YouTubeStyleExtractVideo[]
): UseYouTubeStyleExtractReturn {
  const { user } = useAuth();
  const {
    extractStyleFromYouTube,
    createStyle,
    refresh: refreshStyles,
    isExtractingFromYouTube: isExtracting,
  } = useStyles();

  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [extractError, setExtractError] = useState<string | null>(null);

  const toggleSelectVideo = useCallback((videoId: string) => {
    setSelectedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else if (next.size < MAX_SELECT) {
        next.add(videoId);
      }
      return next;
    });
  }, []);

  const canExtract =
    selectedVideoIds.size >= MIN_SELECT && selectedVideoIds.size <= MAX_SELECT;

  const clearExtractError = useCallback(() => {
    setExtractError(null);
  }, []);

  const handleExtractStyle = useCallback(async (): Promise<DbStyle | null> => {
    if (selectedVideoIds.size < MIN_SELECT) return null;

    const thumbnailUrls = videos
      .filter((v) => selectedVideoIds.has(v.videoId) && v.thumbnailUrl)
      .map((v) => v.thumbnailUrl);

    if (thumbnailUrls.length < MIN_SELECT) {
      toast.error("Select at least 2 videos with thumbnails");
      return null;
    }

    setExtractError(null);

    const result = await extractStyleFromYouTube(thumbnailUrls);
    if (!result) {
      setExtractError(DEFAULT_ERROR);
      toast.error(DEFAULT_ERROR);
      return null;
    }

    if (!user) return null;

    const newStyle = await createStyle({
      name: result.name || "Extracted Style",
      description: result.description ?? null,
      prompt: result.prompt ?? null,
      reference_images: result.reference_images,
      colors: [],
    });

    if (newStyle) {
      await refreshStyles();
      setSelectedVideoIds(new Set());
      toast.success("Style created. You can edit the name and generate a preview.");
      return newStyle;
    }

    toast.error("Failed to save style");
    return null;
  }, [
    videos,
    selectedVideoIds,
    user,
    extractStyleFromYouTube,
    createStyle,
    refreshStyles,
  ]);

  return {
    selectedVideoIds,
    toggleSelectVideo,
    canExtract,
    handleExtractStyle,
    isExtracting,
    extractError,
    clearExtractError,
  };
}
