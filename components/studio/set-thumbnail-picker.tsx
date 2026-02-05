"use client";

/**
 * SetThumbnailPicker
 *
 * Dialog to choose a ViewBait thumbnail and set it as a YouTube video's thumbnail.
 * Uses studio thumbnails (excludes generating); shows empty state with link to Create tab.
 * Portaled with high z-index so it appears above the video card HoverCard.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/components/studio/studio-provider";
import { getCombinedThumbnailsList } from "@/lib/utils/studio-thumbnails";
import { setVideoThumbnail } from "@/lib/services/youtube-set-thumbnail";
import { useYouTubeIntegration } from "@/lib/hooks/useYouTubeIntegration";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Thumbnail } from "@/lib/types/database";

export interface SetThumbnailPickerProps {
  videoId: string;
  videoTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after successful upload (e.g. refetch videos). */
  onSuccess?: () => void;
}

export function SetThumbnailPicker({
  videoId,
  videoTitle,
  open,
  onOpenChange,
  onSuccess,
}: SetThumbnailPickerProps) {
  const { data, actions } = useStudio();
  const { reconnect } = useYouTubeIntegration();
  const [selected, setSelected] = useState<Thumbnail | null>(null);
  const [loading, setLoading] = useState(false);
  const thumbnailRefsMap = useRef<Record<string, HTMLButtonElement | null>>({});

  const { thumbnails, generatingItems } = data;
  const combinedList = useMemo(
    () => getCombinedThumbnailsList(thumbnails, generatingItems ?? new Map()),
    [thumbnails, generatingItems]
  );
  const selectableList = useMemo(
    () => combinedList.filter((t) => !t.generating),
    [combinedList]
  );
  const isEmpty = selectableList.length === 0;

  const handleSelect = useCallback((t: Thumbnail) => {
    setSelected(t);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const result = await setVideoThumbnail(videoId, { thumbnail_id: selected.id });
      if (result.success) {
        toast.success("Thumbnail updated on YouTube.");
        onOpenChange(false);
        setSelected(null);
        onSuccess?.();
      } else {
        if (result.code === "SCOPE_REQUIRED") {
          const description = result.redirect_uri_hint
            ? `Add this URL to Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs, then click Reconnect:\n${result.redirect_uri_hint}`
            : undefined;
          toast.error("Thumbnail upload requires extra permission. Reconnect your YouTube account (or add the redirect URI to GCP).", {
            description,
            action: {
              label: "Reconnect",
              onClick: () => reconnect(),
            },
          });
        } else if (result.code === "TIER_REQUIRED") {
          toast.error("YouTube integration is available on the Pro plan.");
        } else if (result.code === "NOT_CONNECTED") {
          toast.error("YouTube not connected. Connect your account in the YouTube tab.");
        } else {
          toast.error(result.error || "Failed to set thumbnail");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selected, videoId, onOpenChange, onSuccess, reconnect]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setSelected(null);
      onOpenChange(next);
    },
    [onOpenChange]
  );

  const handleViewCreate = useCallback(() => {
    onOpenChange(false);
    actions.setView("generator");
  }, [actions, onOpenChange]);

  const scrollToSelected = useCallback(() => {
    if (!selected) return;
    const el = thumbnailRefsMap.current[selected.id];
    if (el) {
      const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    }
  }, [selected]);

  useEffect(() => {
    if (selected) scrollToSelected();
  }, [selected, scrollToSelected]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLButtonElement>) => {
    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    e.currentTarget.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }, []);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "z-[10003] flex h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw] flex-col gap-5 p-6 sm:max-w-[90vw]"
        )}
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle id="set-thumbnail-dialog-title">
            Use thumbnail for this video
          </DialogTitle>
        </DialogHeader>
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Create a thumbnail in the Create tab first.
            </p>
            <Button variant="secondary" onClick={handleViewCreate}>
              Open Create tab
            </Button>
          </div>
        ) : (
          <>
            <p className="shrink-0 text-sm text-muted-foreground">
              Choose a thumbnail to set as this video&apos;s thumbnail on YouTube.
            </p>
            <div
              className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 overflow-y-auto hide-scrollbar scroll-smooth p-4"
              style={{ scrollBehavior: reducedMotion ? "auto" : "smooth" }}
              role="listbox"
              aria-label="Your thumbnails"
            >
              {selectableList.map((t) => (
                <motion.button
                  key={t.id}
                  ref={(el) => {
                    thumbnailRefsMap.current[t.id] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected?.id === t.id}
                  className={cn(
                    "relative aspect-video w-full rounded-xl border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    selected?.id === t.id
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-transparent hover:border-muted-foreground/40 hover:ring-2 hover:ring-muted-foreground/20"
                  )}
                  onClick={() => handleSelect(t)}
                  onFocus={handleFocus}
                  whileHover={{
                    scale: reducedMotion ? 1 : 1.06,
                    y: reducedMotion ? 0 : -8,
                    zIndex: reducedMotion ? undefined : 10,
                    boxShadow: reducedMotion ? undefined : "0 16px 40px -10px rgb(0 0 0 / 0.25), 0 12px 20px -8px rgb(0 0 0 / 0.15)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                >
                  <span className="block h-full w-full overflow-hidden rounded-[10px]">
                    <img
                      src={t.thumbnail800wUrl || t.thumbnail400wUrl || t.imageUrl}
                      alt={t.name}
                      className="h-full w-full object-cover"
                    />
                  </span>
                </motion.button>
              ))}
            </div>
            {selected && (
              <div className="flex shrink-0 items-center justify-between gap-2 border-t pt-4">
                <p className="text-sm text-muted-foreground truncate flex-1">
                  Set &quot;{selected.name}&quot; as thumbnail?
                </p>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(null)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleConfirm} disabled={loading}>
                    {loading ? "Setting…" : "Set thumbnail"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
