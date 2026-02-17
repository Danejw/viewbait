"use client";

/**
 * YouTubeVideoCard Component
 *
 * Card for displaying a YouTube video thumbnail and title.
 * Mirrors ThumbnailCard look and feel: same Card, aspect-video, border/radius.
 * Action bar on hover (HoverCard): Copy title, Open on YouTube, Video analysis (planned).
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Eye, ThumbsUp, BarChart3, ScanLine, Thermometer, RefreshCw, Layers, ImagePlus, Lightbulb, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCompactNumber } from "@/lib/utils/format";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import { ActionBarIcon, ActionButton } from "@/components/studio/action-bar-icon";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { useStudio } from "@/components/studio/studio-provider";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { fetchImageAsBase64Client } from "@/lib/utils/fetch-image-as-base64-client";
import { generateThumbnailHeatmap } from "@/lib/services/thumbnail-heatmap";
import { analyzeYouTubeVideo, suggestThumbnailConcepts, type ThumbnailConcept } from "@/lib/services/youtube-video-analyze";
import { checkChannelConsistency } from "@/lib/services/youtube-channel-consistency";
import { buildVideoUnderstandingSummary } from "@/lib/utils/video-context-summary";
import { copyToClipboardWithToast } from "@/lib/utils/clipboard";
import { SetThumbnailPicker } from "@/components/studio/set-thumbnail-picker";
import { YouTubeSeoOptimizerModal } from "@/components/studio/youtube-seo-optimizer-modal";
import type { DragData } from "@/components/studio/studio-dnd-context";
import type { Thumbnail } from "@/lib/types/database";

const HEATMAP_QUERY_KEY = "thumbnail-heatmap" as const;
const CHANNEL_CONSISTENCY_QUERY_KEY = "channel-consistency" as const;

export interface YouTubeVideoCardVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  /** Optional stats (e.g. from channel-videos proxy) */
  viewCount?: number;
  likeCount?: number;
}

export interface YouTubeVideoCardProps {
  video: YouTubeVideoCardVideo;
  /** First few items load eagerly */
  priority?: boolean;
  /** When provided, show checkbox overlay for selection (e.g. Extract style) */
  selected?: boolean;
  /** Called when user toggles selection; when provided, card click toggles selection instead of opening YouTube */
  onToggleSelect?: (videoId: string) => void;
  /** Optional channel context (e.g. when on My channel) for video analytics summary */
  channel?: { title: string; description?: string } | null;
  /** Other channel thumbnail URLs for channel consistency check (exclude current video; cap 10). */
  otherChannelThumbnailUrls?: string[];
  /** Called after successfully setting a thumbnail on YouTube (e.g. refetch videos). */
  onThumbnailSetSuccess?: () => void;
  /** When false, hide "Use thumbnail for this video" (e.g. not Pro, not connected, or missing scope). Default true for backward compatibility. */
  canSetThumbnail?: boolean;
  /** Channel social/profile links (for generated SEO description links section). */
  channelSocialLinks?: string[];
}

const YOUTUBE_WATCH_URL = "https://www.youtube.com/watch?v=";

/**
 * Skeleton card for loading state (matches ThumbnailCardSkeleton: image area only).
 */
export function YouTubeVideoCardSkeleton() {
  return (
    <Card className="group relative overflow-hidden p-0">
      <div className="relative aspect-video w-full">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </Card>
  );
}

/**
 * YouTubeVideoCard – matches ThumbnailCard layout and styling:
 * Card is aspect-video only (no content below image). Title + icon in top overlay on hover
 * with same gradient, animation (-translate-y-2 → translate-y-0), and typography.
 * Click opens video on YouTube in new tab.
 */
const CONSISTENCY_COOLDOWN_MS = 5000;

function consistencyScoreLabel(score: number): string {
  if (score <= 2) return "Low";
  if (score <= 3) return "Medium";
  return "High";
}

export const YouTubeVideoCard = memo(function YouTubeVideoCard({
  video,
  priority = false,
  selected = false,
  onToggleSelect,
  channel = null,
  otherChannelThumbnailUrls,
  onThumbnailSetSuccess,
  canSetThumbnail = true,
  channelSocialLinks,
}: YouTubeVideoCardProps) {
  const { videoId, title, thumbnailUrl, viewCount, likeCount } = video;
  const [setThumbnailPickerVideo, setSetThumbnailPickerVideo] = useState<{
    videoId: string;
    title: string;
  } | null>(null);
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const hasStats = viewCount != null || likeCount != null;
  const { state, actions } = useStudio();
  const isVideoAnalyticsLoading = state.videoAnalyticsLoadingVideoIds.includes(videoId);
  const hasAnalyticsCached = state.videoAnalyticsCache[videoId] != null;
  const cachedAnalytics = state.videoAnalyticsCache[videoId];
  const hasSuggestConceptsCached = (state.videoSuggestConceptsCache[videoId]?.length ?? 0) > 0;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReRolling, setIsReRolling] = useState(false);
  const [showStyleSuccessBorder, setShowStyleSuccessBorder] = useState(false);
  const [showAnalyticsSuccessBorder, setShowAnalyticsSuccessBorder] = useState(false);
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState(false);
  const [consistencyPopoverOpen, setConsistencyPopoverOpen] = useState(false);
  const [suggestConceptsPopoverOpen, setSuggestConceptsPopoverOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedConcepts, setSuggestedConcepts] = useState<ThumbnailConcept[]>([]);
  const lastConsistencyRequestTime = useRef<number>(0);
  const consistencyJustClosedRef = useRef(false);
  const wasLoadingAnalytics = useRef(false);

  const { tier } = useSubscription();
  const canUseHeatmap = tier === "advanced" || tier === "pro";
  const queryClient = useQueryClient();
  const cachedHeatmapDataUrl = useQuery({
    queryKey: [HEATMAP_QUERY_KEY, videoId],
    queryFn: () => undefined as unknown as string,
    enabled: false,
  }).data as string | undefined;

  const cachedConsistency = useQuery({
    queryKey: [CHANNEL_CONSISTENCY_QUERY_KEY, videoId],
    queryFn: () => undefined as unknown as { score: number; cues: string[] },
    enabled: false,
  }).data as { score: number; cues: string[] } | undefined;

  const consistencyMutation = useMutation({
    mutationFn: async () => {
      const refs = otherChannelThumbnailUrls ?? [];
      if (refs.length === 0) throw new Error("Not enough channel thumbnails to compare.");
      return checkChannelConsistency({
        videoId,
        thumbnailUrl,
        otherThumbnailUrls: refs.slice(0, 10),
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData([CHANNEL_CONSISTENCY_QUERY_KEY, videoId], data);
      // Keep popover closed by default; icon turns red to show data is available; user clicks to view.
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to check channel consistency");
    },
  });

  const heatmapMutation = useMutation({
    mutationFn: async () => {
      const payload = await fetchImageAsBase64Client(thumbnailUrl);
      if (payload) {
        return generateThumbnailHeatmap({
          imageData: payload.data,
          mimeType: payload.mimeType,
        });
      }
      return generateThumbnailHeatmap({ imageUrl: thumbnailUrl });
    },
    onSuccess: (result) => {
      queryClient.setQueryData([HEATMAP_QUERY_KEY, videoId], result.dataUrl);
      setShowHeatmapOverlay(true);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to generate heatmap");
    },
  });

  const [ref, isIntersecting] = useIntersectionObserver({
    rootMargin: "200px",
  });
  const [isLoaded, setIsLoaded] = useState(false);

  const showImage = priority || isIntersecting;
  const watchUrl = `${YOUTUBE_WATCH_URL}${videoId}`;
  const selectionMode = onToggleSelect != null;
  const isAnalyzingOrLoading =
    isAnalyzing || isReRolling || isVideoAnalyticsLoading || heatmapMutation.isPending || consistencyMutation.isPending;

  // Track when analytics loading completes and we have cache → show success border briefly
  useEffect(() => {
    if (isVideoAnalyticsLoading) {
      wasLoadingAnalytics.current = true;
    } else if (wasLoadingAnalytics.current && hasAnalyticsCached) {
      wasLoadingAnalytics.current = false;
      setShowAnalyticsSuccessBorder(true);
    } else if (!isVideoAnalyticsLoading) {
      wasLoadingAnalytics.current = false;
    }
  }, [isVideoAnalyticsLoading, hasAnalyticsCached]);

  useEffect(() => {
    if (!showStyleSuccessBorder) return;
    const t = setTimeout(() => setShowStyleSuccessBorder(false), 2500);
    return () => clearTimeout(t);
  }, [showStyleSuccessBorder]);

  useEffect(() => {
    if (!showAnalyticsSuccessBorder) return;
    const t = setTimeout(() => setShowAnalyticsSuccessBorder(false), 2500);
    return () => clearTimeout(t);
  }, [showAnalyticsSuccessBorder]);

  const dragData: DragData = useMemo(
    () => ({
      type: "thumbnail",
      id: `youtube-thumbnail-${videoId}`,
      item: { imageUrl: thumbnailUrl, name: title } as Thumbnail,
      imageUrl: thumbnailUrl,
    }),
    [videoId, thumbnailUrl, title]
  );

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `youtube-thumbnail-${videoId}`,
    data: dragData,
    disabled: false,
  });

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (selectionMode) {
        e.preventDefault();
        onToggleSelect(videoId);
      } else {
        actions.onOpenVideoWatchAnalytics?.({ videoId, title, thumbnailUrl });
      }
    },
    [selectionMode, onToggleSelect, videoId, title, thumbnailUrl, actions.onOpenVideoWatchAnalytics]
  );

  const handleCheckboxChange = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleSelect?.(videoId);
    },
    [onToggleSelect, videoId]
  );

  const handleUseTitle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      actions.setThumbnailText?.(title);
      const copied = await copyToClipboardWithToast(title, "Title set as thumbnail text and copied");
      if (!copied) toast.success("Title set as thumbnail text");
    },
    [actions.setThumbnailText, title]
  );

  const handleOpenVideo = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      window.open(watchUrl, "_blank", "noopener,noreferrer");
    },
    [watchUrl]
  );

  const handleAnalyzeStyle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const onAnalyze = actions.onAnalyzeThumbnailForInstructions;
      if (!onAnalyze || isAnalyzing) return;
      setIsAnalyzing(true);
      onAnalyze({ imageUrl: thumbnailUrl })
        .then((result) => {
          if (result?.success) setShowStyleSuccessBorder(true);
        })
        .finally(() => setIsAnalyzing(false));
    },
    [actions.onAnalyzeThumbnailForInstructions, thumbnailUrl, isAnalyzing]
  );

  const handleVideoAnalytics = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      actions.onRequestVideoAnalytics?.(
        { videoId, title, thumbnailUrl },
        channel ?? undefined
      );
    },
    [actions.onRequestVideoAnalytics, videoId, title, thumbnailUrl, channel]
  );

  const handleHeatmapClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canUseHeatmap) return;
      if (cachedHeatmapDataUrl) {
        setShowHeatmapOverlay((prev) => !prev);
      } else {
        heatmapMutation.mutate();
      }
    },
    [canUseHeatmap, cachedHeatmapDataUrl, heatmapMutation]
  );

  const handleChannelConsistencyOpenChange = useCallback((open: boolean) => {
    if (open && consistencyJustClosedRef.current) {
      consistencyJustClosedRef.current = false;
      return;
    }
    setConsistencyPopoverOpen(open);
  }, []);

  const handleChannelConsistency = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const refs = otherChannelThumbnailUrls ?? [];
      if (refs.length === 0) {
        toast.error("Not enough channel thumbnails to compare.");
        return;
      }
      if (cachedConsistency) {
        setConsistencyPopoverOpen((prev) => {
          if (prev) consistencyJustClosedRef.current = true;
          return !prev;
        });
        return;
      }
      const now = Date.now();
      if (consistencyMutation.isPending || now - lastConsistencyRequestTime.current < CONSISTENCY_COOLDOWN_MS) {
        return;
      }
      lastConsistencyRequestTime.current = now;
      consistencyMutation.mutate();
    },
    [otherChannelThumbnailUrls, cachedConsistency, consistencyMutation]
  );

  const canShowConsistency = (otherChannelThumbnailUrls?.length ?? 0) > 0;

  const handleSuggestConcepts = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const {
        setVideoAnalyticsCache,
        setVideoSuggestConceptsCache,
      } = actions;
      if (isSuggesting || !setVideoAnalyticsCache) return;

      // Toggle off: if popover is already open, close it.
      if (suggestConceptsPopoverOpen) {
        setSuggestConceptsPopoverOpen(false);
        return;
      }

      // If we already have cached concepts for this video, show them and open popover (no API call).
      const cachedConcepts = state.videoSuggestConceptsCache[videoId];
      if (cachedConcepts?.length) {
        setSuggestedConcepts(cachedConcepts);
        setSuggestConceptsPopoverOpen(true);
        return;
      }

      let analytics = state.videoAnalyticsCache[videoId];
      if (!analytics) {
        setIsSuggesting(true);
        const { analytics: fetched, error } = await analyzeYouTubeVideo(videoId);
        if (error || !fetched) {
          toast.error(error?.message ?? "Failed to analyze video");
          setIsSuggesting(false);
          return;
        }
        setVideoAnalyticsCache(videoId, fetched);
        analytics = fetched;
      }

      setIsSuggesting(true);
      const { concepts, error } = await suggestThumbnailConcepts(videoId, title, analytics);
      setIsSuggesting(false);
      if (error || !concepts?.length) {
        toast.error(error?.message ?? "Failed to suggest concepts");
        return;
      }
      setVideoSuggestConceptsCache?.(videoId, concepts);
      setSuggestedConcepts(concepts);
      setSuggestConceptsPopoverOpen(true);
    },
    [
      actions,
      isSuggesting,
      state.videoAnalyticsCache,
      state.videoSuggestConceptsCache,
      suggestConceptsPopoverOpen,
      title,
      videoId,
    ]
  );

  const handleUseConcept = useCallback(
    (concept: ThumbnailConcept) => {
      const {
        setThumbnailText,
        setCustomInstructions,
        markReRollDataApplied,
      } = actions;
      const cached = state.videoAnalyticsCache[videoId];
      if (!setThumbnailText || !setCustomInstructions || !markReRollDataApplied) return;
      setThumbnailText(concept.text);
      if (cached) {
        setCustomInstructions(buildVideoUnderstandingSummary(cached, title, channel ?? null));
      }
      markReRollDataApplied();
      setSuggestConceptsPopoverOpen(false);
      toast.success("Using video context for this suggestion");
    },
    [actions, channel, state.videoAnalyticsCache, title, videoId]
  );

  const handleReRollWithVideoContext = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const {
        setThumbnailText,
        setCustomInstructions,
        markReRollDataApplied,
        setVideoAnalyticsCache,
      } = actions;
      if (isReRolling || !setThumbnailText || !setCustomInstructions || !markReRollDataApplied) return;

      const cached = state.videoAnalyticsCache[videoId];
      if (cached) {
        setThumbnailText(title);
        setCustomInstructions(buildVideoUnderstandingSummary(cached, title, channel ?? null));
        markReRollDataApplied();
        return;
      }

      setIsReRolling(true);
      try {
        setThumbnailText(title);
        const { analytics, error } = await analyzeYouTubeVideo(videoId);
        if (error || !analytics) {
          toast.error(error?.message ?? "Failed to analyze video");
          return;
        }
        setVideoAnalyticsCache?.(videoId, analytics);
        const summary = buildVideoUnderstandingSummary(analytics, title, channel ?? null);
        setCustomInstructions(summary);
        markReRollDataApplied();
      } finally {
        setIsReRolling(false);
      }
    },
    [
      actions,
      channel,
      isReRolling,
      state.videoAnalyticsCache,
      title,
      videoId,
    ]
  );

  const actionBar = (
    <motion.div
      className="flex items-center justify-center gap-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <ActionButton icon={Copy} label="Use title" onClick={handleUseTitle} />
      {canSetThumbnail && hasAnalyticsCached && (
        <ActionButton
          icon={Sparkles}
          label="Generate SEO title + description"
          onClick={() => setSeoModalOpen(true)}
        />
      )}
      {canSetThumbnail && (
        <ActionButton
          icon={ImagePlus}
          label="Use thumbnail for this video"
          onClick={() => setSetThumbnailPickerVideo({ videoId, title })}
        />
      )}
      <ActionButton icon={ExternalLink} label="Open on YouTube" onClick={handleOpenVideo} />
      <ActionButton
        icon={isReRolling ? ViewBaitLogo : RefreshCw}
        label={isReRolling ? "Re-rolling…" : "Re-roll with video context"}
        onClick={handleReRollWithVideoContext}
        disabled={isReRolling}
        iconClassName={isReRolling ? "animate-spin" : undefined}
      />
      <Popover open={suggestConceptsPopoverOpen} onOpenChange={setSuggestConceptsPopoverOpen}>
        <PopoverAnchor asChild>
          <span>
            <ActionButton
              icon={isSuggesting ? ViewBaitLogo : Lightbulb}
              label={
                suggestConceptsPopoverOpen
                  ? "Hide concepts"
                  : isSuggesting
                    ? "Suggesting…"
                    : "Suggest thumbnail concepts"
              }
              onClick={handleSuggestConcepts}
              disabled={isSuggesting || isReRolling || isVideoAnalyticsLoading}
              active={hasSuggestConceptsCached}
              iconClassName={cn(
                isSuggesting && "animate-spin",
                hasSuggestConceptsCached && "text-primary"
              )}
            />
          </span>
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="center"
          sideOffset={8}
          className="z-[10002] w-80 max-h-[min(60vh,400px)] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-describedby="suggested-concepts-list"
        >
          <p className="text-sm font-medium text-foreground mb-2">Thumbnail concepts from video</p>
          <p className="text-xs text-muted-foreground mb-3">Click &quot;Use this&quot; to pre-fill the generator with video context.</p>
          <ul id="suggested-concepts-list" className="space-y-2" role="list">
            {suggestedConcepts.map((concept, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-2">
                <p className="text-sm text-foreground line-clamp-2">{concept.text}</p>
                {concept.styleHint && (
                  <p className="text-xs text-muted-foreground">{concept.styleHint}</p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-fit mt-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseConcept(concept);
                  }}
                >
                  Use this
                </Button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <ActionButton
        icon={isAnalyzing ? ViewBaitLogo : ScanLine}
        label="Analyze style and add to instructions"
        onClick={handleAnalyzeStyle}
        disabled={isAnalyzing}
        iconClassName={isAnalyzing ? "animate-spin" : undefined}
      />
      <ActionButton
        icon={isVideoAnalyticsLoading ? ViewBaitLogo : BarChart3}
        label={isVideoAnalyticsLoading ? "Analyzing…" : "Video analytics"}
        onClick={handleVideoAnalytics}
        disabled={isReRolling || isVideoAnalyticsLoading}
        iconClassName={cn(
          isVideoAnalyticsLoading && "animate-spin",
          hasAnalyticsCached && "text-primary"
        )}
      />
      {canUseHeatmap && (
        <ActionButton
          icon={heatmapMutation.isPending ? ViewBaitLogo : Thermometer}
          label={showHeatmapOverlay ? "Hide heatmap" : "Attention heatmap"}
          onClick={handleHeatmapClick}
          disabled={heatmapMutation.isPending}
          active={showHeatmapOverlay}
          iconClassName={heatmapMutation.isPending ? "animate-spin" : undefined}
        />
      )}
      {canShowConsistency && (
        <Popover open={consistencyPopoverOpen} onOpenChange={handleChannelConsistencyOpenChange}>
          <PopoverAnchor asChild>
            <span>
              <ActionButton
                icon={consistencyMutation.isPending ? ViewBaitLogo : Layers}
                label={
                  cachedConsistency
                    ? consistencyPopoverOpen
                      ? "Hide channel fit"
                      : "Show channel fit"
                    : "Does this fit my channel?"
                }
                onClick={handleChannelConsistency}
                disabled={consistencyMutation.isPending}
                active={!!cachedConsistency}
                iconClassName={consistencyMutation.isPending ? "animate-spin" : undefined}
              />
            </span>
          </PopoverAnchor>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={8}
            className="z-[10002] w-64"
            onOpenAutoFocus={(e) => e.preventDefault()}
            aria-describedby={cachedConsistency ? "channel-consistency-result" : undefined}
          >
            {cachedConsistency ? (
              <div id="channel-consistency-result" role="status" aria-live="polite">
                <p
                  className={cn(
                    "font-medium",
                    cachedConsistency.score <= 2 && "text-amber-600 dark:text-amber-500",
                    cachedConsistency.score === 3 && "text-foreground",
                    cachedConsistency.score >= 4 && "text-green-600 dark:text-green-500"
                  )}
                >
                  Channel fit: {consistencyScoreLabel(cachedConsistency.score)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cachedConsistency.score}/5
                  {cachedConsistency.cues.length > 0 && (
                    <> · {cachedConsistency.cues.slice(0, 2).join("; ")}</>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">Run a check to see how this thumbnail fits your channel.</p>
            )}
          </PopoverContent>
        </Popover>
      )}
    </motion.div>
  );

  return (
    <div ref={ref} className="w-full">
      <HoverCard openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Card
            ref={setNodeRef}
            className={cn(
              "group relative aspect-video w-full cursor-pointer overflow-hidden p-0 transition-all",
              "hover:ring-2 hover:ring-primary/50 hover:shadow-lg",
              selectionMode && selected && "ring-2 ring-primary",
              isDragging && "opacity-50 ring-2 ring-primary cursor-grabbing",
              !isDragging && "cursor-grab",
              (showStyleSuccessBorder || showAnalyticsSuccessBorder) &&
                "thumbnail-card-border-success"
            )}
            onClick={handleClick}
            {...listeners}
            {...attributes}
          >
            {isAnalyzingOrLoading ? (
              /* CRT analyzing animation (style analysis or video analytics loading) */
              <div className={cn("studio-analyzing-wrapper", "is-analyzing")}>
                <div className="studio-analyzing-card">
                  {showImage && (
                    <img
                      src={thumbnailUrl}
                      alt={title}
                      className="studio-analyzing-thumbnail"
                    />
                  )}
                  {!showImage && (
                    <div className="absolute inset-0 bg-muted" aria-hidden />
                  )}
                  <div className="studio-analyzing-scanlines" aria-hidden />
                  <div className="studio-analyzing-scan-line" aria-hidden />
                  <div className="studio-analyzing-rgb" aria-hidden />
                  <div className="studio-analyzing-vignette" aria-hidden />
                  <div className="studio-analyzing-corner tl" aria-hidden />
                  <div className="studio-analyzing-corner tr" aria-hidden />
                  <div className="studio-analyzing-corner bl" aria-hidden />
                  <div className="studio-analyzing-corner br" aria-hidden />
                  <div className="studio-analyzing-status">
                    <div className="studio-analyzing-status-dot" aria-hidden />
                    <span className="studio-analyzing-status-text">
                      {isReRolling
                        ? "RE-ROLLING"
                        : heatmapMutation.isPending
                          ? "HEATMAP"
                          : consistencyMutation.isPending
                            ? "CONSISTENCY"
                            : "ANALYZING"}
                    </span>
                  </div>
                  <div className="studio-analyzing-title">
                    <div className="studio-analyzing-title-text">{title}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative h-full w-full overflow-hidden bg-muted">
                {showImage && (
                  <>
                    {!isLoaded && (
                      <Skeleton className="absolute inset-0 h-full w-full" />
                    )}
                    <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
                      <img
                        src={thumbnailUrl}
                        alt={title}
                        onLoad={() => setIsLoaded(true)}
                        loading={priority ? "eager" : "lazy"}
                        decoding="async"
                        className={cn(
                          "h-full w-full object-cover transition-all duration-300",
                          isLoaded ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </div>
                    {showHeatmapOverlay && cachedHeatmapDataUrl && (
                      <div
                        className="absolute inset-0 z-10 pointer-events-none"
                        aria-hidden
                      >
                        <img
                          src={cachedHeatmapDataUrl}
                          alt=""
                          className="h-full w-full object-cover opacity-60"
                        />
                      </div>
                    )}
                  </>
                )}
                {selectionMode && (
                  <div
                    className="absolute left-2 top-2 z-10"
                    onClick={handleCheckboxChange}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onToggleSelect?.(videoId);
                      }
                    }}
                    aria-label={selected ? "Deselect video" : "Select video"}
                  >
                    <Checkbox
                      checked={selected}
                      className="h-5 w-5 border-2 border-white bg-black/50 shadow-md pointer-events-none"
                    />
                  </div>
                )}
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 flex items-start justify-between p-2",
                    "bg-gradient-to-b from-black/60 to-transparent",
                    "opacity-0 -translate-y-2 transition-all duration-200 ease-out",
                    "group-hover:opacity-100 group-hover:translate-y-0",
                    selectionMode && "pl-10"
                  )}
                >
                  <p
                    className="max-w-full truncate text-sm font-medium text-white drop-shadow-sm"
                    title={title}
                  >
                    {title}
                  </p>
                </div>
                {hasStats && (
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0 flex items-center gap-3 px-2 py-1.5",
                      "bg-gradient-to-t from-black/60 to-transparent",
                      "opacity-0 transition-opacity duration-200 ease-out",
                      "group-hover:opacity-100"
                    )}
                  >
                    {viewCount != null && (
                      <span className="flex items-center gap-1 text-xs text-white drop-shadow-sm">
                        <Eye className="h-3.5 w-3.5" />
                        {formatCompactNumber(viewCount)}
                      </span>
                    )}
                    {likeCount != null && (
                      <span className="flex items-center gap-1 text-xs text-white drop-shadow-sm">
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {formatCompactNumber(likeCount)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="center"
          sideOffset={8}
          className="w-auto border-0 bg-transparent p-0 shadow-none ring-0 duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[side=top]:data-open:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=top]:data-closed:slide-out-to-bottom-2"
        >
          {actionBar}
        </HoverCardContent>
      </HoverCard>
      {setThumbnailPickerVideo && (
        <SetThumbnailPicker
          videoId={setThumbnailPickerVideo.videoId}
          videoTitle={setThumbnailPickerVideo.title}
          open={true}
          onOpenChange={(open) => !open && setSetThumbnailPickerVideo(null)}
          onSuccess={onThumbnailSetSuccess}
        />
      )}
      {seoModalOpen && cachedAnalytics && (
        <YouTubeSeoOptimizerModal
          open={seoModalOpen}
          onOpenChange={setSeoModalOpen}
          videoId={videoId}
          videoTitle={title}
          analytics={cachedAnalytics}
          channelTitle={channel?.title}
          channelDescription={channel?.description}
          channelSocialLinks={channelSocialLinks}
        />
      )}
    </div>
  );
});

export default YouTubeVideoCard;
