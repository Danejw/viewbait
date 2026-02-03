"use client";

/**
 * YouTubeStyleExtractBar
 *
 * Reusable bar for "extract style from selected YouTube thumbnails":
 * hint text, Extract style button, and error block. Used by both
 * My channel and Import by URL tabs.
 */

import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { Sparkles } from "lucide-react";

export interface YouTubeStyleExtractBarProps {
  selectedCount: number;
  canExtract: boolean;
  isExtracting: boolean;
  extractError: string | null;
  onExtract: () => void;
  onClearError: () => void;
}

export const YouTubeStyleExtractBar = memo(function YouTubeStyleExtractBar({
  selectedCount,
  canExtract,
  isExtracting,
  extractError,
  onExtract,
  onClearError,
}: YouTubeStyleExtractBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Select 2–10 videos to extract a common style.
        </p>
        {selectedCount > 0 && (
          <Button
            variant={canExtract ? "default" : "outline"}
            size="sm"
            onClick={onExtract}
            disabled={!canExtract || isExtracting}
            className="gap-2"
          >
            {isExtracting ? (
              <>
                <ViewBaitLogo className="h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Extract style {selectedCount > 0 ? `(${selectedCount} selected)` : ""}
              </>
            )}
          </Button>
        )}
      </div>
      {extractError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
          <p className="text-sm text-destructive">{extractError}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={onClearError}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
});

export default YouTubeStyleExtractBar;
