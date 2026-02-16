"use client";

/**
 * YouTubeVideoAnalyticsModal
 *
 * Displays Gemini video-understanding analytics for a YouTube video in a modal.
 * Each section is collapsible: Summary and Topic/tone/pacing open by default;
 * Key moments, Hooks, Thumbnail notes, Characters, and Places collapsed by default.
 * When characters exist, offers "Extract character snapshots" from the video URL (streamed via API) or via file upload fallback.
 */

import React, { useRef, useCallback, useState, useEffect } from "react";
import { BarChart3, ExternalLink, ChevronDown, Film, Copy, FileText } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
} from "@/components/ui/modal";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { YouTubeVideoAnalytics } from "@/lib/services/youtube-video-analyze";
import { getRepresentativeSecondsForCharacter, getRepresentativeSecondsForPlace } from "@/lib/utils/timestamp-parse";
import { extractFramesAt } from "@/lib/services/ffmpeg-frame-extract";
import { buildVideoUnderstandingSummary } from "@/lib/utils/video-context-summary";
import { copyToClipboardWithToast } from "@/lib/utils/clipboard";
import { getErrorMessage } from "@/lib/utils/error";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { emitTourEvent } from "@/tourkit/app/tourEvents.browser";

const YOUTUBE_WATCH_URL = "https://www.youtube.com/watch?v=";

export interface CharacterSnapshotItem {
  characterName: string;
  imageBlobUrl: string;
  blob: Blob;
}

export interface PlaceSnapshotItem {
  placeName: string;
  imageBlobUrl: string;
  blob: Blob;
}

export interface YouTubeVideoForAnalytics {
  videoId: string;
  title: string;
  thumbnailUrl: string;
}

export interface YouTubeVideoAnalyticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: YouTubeVideoForAnalytics | null;
  analytics: YouTubeVideoAnalytics | null;
  loading?: boolean;
  error?: string | null;
  /** When provided and analytics has characters, "Extract character snapshots" is shown */
  onSetCharacterSnapshots?: (videoId: string, snapshots: CharacterSnapshotItem[]) => void;
  /** When provided and analytics has places, "Extract place snapshots" is shown */
  onSetPlaceSnapshots?: (videoId: string, snapshots: PlaceSnapshotItem[]) => void;
  /** Optional channel context for the summary (e.g. when opened from My channel). */
  channelForContext?: { title: string; description?: string } | null;
  /** When provided, "Add to custom instructions" appends the summary with key "video understanding context". */
  onAppendToCustomInstructions?: (summary: string) => void;
}

function RubricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <p className="text-sm text-foreground break-words whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function CollapsibleSection({
  label,
  defaultOpen,
  children,
  headerHint,
  headerHintClassName,
}: {
  label: string;
  defaultOpen: boolean;
  children: React.ReactNode;
  headerHint?: string;
  headerHintClassName?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group min-w-0 rounded-lg border border-border/60 bg-muted/20">
      <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors rounded-lg">
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground rotate-[-90deg] transition-transform group-data-[state=open]:rotate-0" />
        <span className="shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {headerHint && (
          <span className={cn("min-w-0 truncate text-sm", headerHintClassName ?? "text-muted-foreground")} title={headerHint}>
            {headerHint}
          </span>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="min-w-0 overflow-hidden px-3 pb-3 pt-0 border-t border-border/40 mt-0">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function YouTubeVideoAnalyticsModal({
  open,
  onOpenChange,
  video,
  analytics,
  loading = false,
  error = null,
  onSetCharacterSnapshots,
  onSetPlaceSnapshots,
  channelForContext = null,
  onAppendToCustomInstructions,
}: YouTubeVideoAnalyticsModalProps) {
  type ExtractType = "characters" | "places";
  const fileInputRefs = useRef<Record<ExtractType, HTMLInputElement | null>>({ characters: null, places: null });

  const [extractState, setExtractState] = useState<
    Record<ExtractType, { extracting: boolean; phase: "idle" | "fetching" | "extracting"; error: string | null }>
  >({
    characters: { extracting: false, phase: "idle", error: null },
    places: { extracting: false, phase: "idle", error: null },
  });

  useEffect(() => {
    emitTourEvent(open ? "tour.event.modal.opened" : "tour.event.modal.closed", { modal: "youtubeAnalytics" });
  }, [open]);

  const runExtractionWithFile = useCallback(
    async (type: ExtractType, file: File) => {
      const setError = (msg: string) =>
        setExtractState((prev) => ({ ...prev, [type]: { ...prev[type], error: msg } }));
      const VIDEO_UNAVAILABLE = "Video unavailable or private. Try uploading a file instead.";
      const NO_FRAMES = "No frames could be extracted.";

      if (type === "characters") {
        if (!video || !analytics?.characters?.length || !onSetCharacterSnapshots) return;
        const timestamps = analytics.characters.map((char) => getRepresentativeSecondsForCharacter(char) ?? 0);
        const { blobs, error: extractErr } = await extractFramesAt(file, timestamps);
        if (extractErr || blobs.length === 0) {
          setError(extractErr ?? NO_FRAMES);
          return;
        }
        const snapshots: CharacterSnapshotItem[] = analytics.characters.slice(0, blobs.length).map((char, i) => ({
          characterName: char.name,
          imageBlobUrl: URL.createObjectURL(blobs[i]),
          blob: blobs[i],
        }));
        onSetCharacterSnapshots(video.videoId, snapshots);
        toast.success("Character snapshots extracted. Drag them to Faces or References on the right.");
      } else {
        if (!video || !analytics?.places?.length || !onSetPlaceSnapshots) return;
        const timestamps = analytics.places.map((place) => getRepresentativeSecondsForPlace(place) ?? 0);
        const { blobs, error: extractErr } = await extractFramesAt(file, timestamps);
        if (extractErr || blobs.length === 0) {
          setError(extractErr ?? NO_FRAMES);
          return;
        }
        const snapshots: PlaceSnapshotItem[] = analytics.places.slice(0, blobs.length).map((place, i) => ({
          placeName: place.name,
          imageBlobUrl: URL.createObjectURL(blobs[i]),
          blob: blobs[i],
        }));
        onSetPlaceSnapshots(video.videoId, snapshots);
        toast.success("Place snapshots extracted. Drag them to Faces or References on the right.");
      }
      onOpenChange(false);
    },
    [video, analytics, onSetCharacterSnapshots, onSetPlaceSnapshots, onOpenChange]
  );

  const handleExtractFromVideo = useCallback(
    async (type: ExtractType) => {
      const isCharacters = type === "characters";
      const hasData = isCharacters
        ? analytics?.characters?.length && onSetCharacterSnapshots
        : analytics?.places?.length && onSetPlaceSnapshots;
      const state = extractState[type];
      if (!video || !hasData || state.extracting) return;

      setExtractState((prev) => ({ ...prev, [type]: { ...prev[type], error: null, extracting: true, phase: "fetching" } }));
      const setPhase = (phase: "idle" | "fetching" | "extracting") =>
        setExtractState((prev) => ({ ...prev, [type]: { ...prev[type], phase } }));
      const setError = (msg: string) =>
        setExtractState((prev) => ({ ...prev, [type]: { ...prev[type], error: msg, extracting: false, phase: "idle" } }));
      const setDone = () =>
        setExtractState((prev) => ({ ...prev, [type]: { ...prev[type], extracting: false, phase: "idle" } }));

      const VIDEO_UNAVAILABLE = "Video unavailable or private. Try uploading a file instead.";
      try {
        const res = await fetch(`/api/youtube/videos/${video.videoId}/stream`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error ?? VIDEO_UNAVAILABLE);
          return;
        }
        const blob = await res.blob();
        const file = new File([blob], "video.mp4", { type: blob.type || "video/mp4" });
        setPhase("extracting");
        await runExtractionWithFile(type, file);
      } catch (err) {
        setError(getErrorMessage(err, VIDEO_UNAVAILABLE));
      } finally {
        setDone();
      }
    },
    [video, analytics, onSetCharacterSnapshots, onSetPlaceSnapshots, extractState, runExtractionWithFile]
  );

  const handleUploadFallback = useCallback((type: ExtractType) => {
    setExtractState((prev) => ({ ...prev, [type]: { ...prev[type], error: null } }));
    fileInputRefs.current[type]?.click();
  }, []);

  const handleFileChange = useCallback(
    async (type: ExtractType, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const isCharacters = type === "characters";
      const hasData = isCharacters
        ? analytics?.characters?.length && onSetCharacterSnapshots
        : analytics?.places?.length && onSetPlaceSnapshots;
      if (!file || !video || !hasData) return;

      setExtractState((prev) => ({ ...prev, [type]: { ...prev[type], extracting: true, error: null, phase: "extracting" } }));
      const setError = (msg: string) =>
        setExtractState((prev) => ({ ...prev, [type]: { ...prev[type], error: msg, extracting: false, phase: "idle" } }));
      const setDone = () =>
        setExtractState((prev) => ({ ...prev, [type]: { ...prev[type], extracting: false, phase: "idle" } }));
      try {
        await runExtractionWithFile(type, file);
      } catch (err) {
        setError(getErrorMessage(err, "Extraction failed."));
      } finally {
        setDone();
      }
    },
    [video, analytics, onSetCharacterSnapshots, onSetPlaceSnapshots, runExtractionWithFile]
  );

  if (!video) return null;

  const watchUrl = `${YOUTUBE_WATCH_URL}${video.videoId}`;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="2xl" showCloseButton={true} className="max-w-[calc(100vw-2rem)] overflow-x-hidden">
        <div data-tour="tour.studio.modal.youtubeAnalytics" />
        <ModalHeader className="gap-2 min-w-0 pr-8">
          <div className="flex min-w-0 items-center gap-2">
            <BarChart3 className="h-5 w-5 shrink-0 text-muted-foreground" />
            <ModalTitle className="min-w-0 truncate">Video analytics</ModalTitle>
          </div>
          <p className="min-w-0 truncate text-muted-foreground text-sm font-normal" title={video.title}>
            {video.title}
          </p>
        </ModalHeader>
        <ModalBody className="min-w-0 gap-4 overflow-hidden pr-1">
          {/* Video preview strip */}
          <div className="flex min-w-0 gap-3 rounded-lg overflow-hidden bg-muted/50 p-2">
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 w-40 aspect-video rounded overflow-hidden ring-1 ring-border hover:ring-primary/50 transition-all"
            >
              <img
                src={video.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </a>
            <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Watch on YouTube
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && analytics && (
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const summary = buildVideoUnderstandingSummary(
                      analytics,
                      video.title,
                      channelForContext ?? undefined
                    );
                    copyToClipboardWithToast(summary, "Context copied to clipboard");
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copy context to clipboard
                </Button>
                {onAppendToCustomInstructions && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const summary = buildVideoUnderstandingSummary(
                        analytics,
                        video.title,
                        channelForContext ?? undefined
                      );
                      onAppendToCustomInstructions(summary);
                      toast.success("Added to Custom Instructions");
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    Add to custom instructions
                  </Button>
                )}
              </div>
              <CollapsibleSection
                label="Summary"
                defaultOpen={true}
                headerHint={analytics.summary.slice(0, 80).trim() + (analytics.summary.length > 80 ? "…" : "")}
              >
                <p className="text-sm text-foreground break-words whitespace-pre-wrap pt-2">{analytics.summary}</p>
              </CollapsibleSection>

              <CollapsibleSection
                label="Topic, tone & pacing"
                defaultOpen={true}
                headerHint={`${analytics.topic} · ${analytics.content_type}`}
              >
                <div className="grid min-w-0 grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                  <RubricRow label="Topic" value={analytics.topic} />
                  <RubricRow label="Content type" value={analytics.content_type} />
                  <RubricRow label="Tone" value={analytics.tone} />
                  <RubricRow label="Duration / pacing" value={analytics.duration_estimate} />
                </div>
              </CollapsibleSection>

              <CollapsibleSection label="Key moments" defaultOpen={false}>
                <p className="text-sm text-foreground break-words whitespace-pre-wrap pt-2">{analytics.key_moments}</p>
              </CollapsibleSection>

              <CollapsibleSection label="Hooks" defaultOpen={false}>
                <p className="text-sm text-foreground break-words whitespace-pre-wrap pt-2">{analytics.hooks}</p>
              </CollapsibleSection>

              <CollapsibleSection label="Thumbnail appeal notes" defaultOpen={false}>
                <p className="text-sm text-foreground break-words whitespace-pre-wrap pt-2">{analytics.thumbnail_appeal_notes}</p>
              </CollapsibleSection>

              {analytics.characters && analytics.characters.length > 0 && (
                <CollapsibleSection
                  label="Characters"
                  defaultOpen={false}
                  headerHint={`${analytics.characters.length} character${analytics.characters.length !== 1 ? "s" : ""}`}
                  headerHintClassName="text-primary"
                >
                  <div className="flex min-w-0 flex-col gap-4 pt-2">
                    {onSetCharacterSnapshots && (
                      <>
                        <input
                          ref={(el) => { fileInputRefs.current.characters = el; }}
                          type="file"
                          accept="video/*"
                          className="sr-only"
                          aria-label="Select video file for frame extraction"
                          onChange={(e) => handleFileChange("characters", e)}
                          disabled={extractState.characters.extracting}
                        />
                        <button
                          type="button"
                          onClick={() => handleExtractFromVideo("characters")}
                          disabled={extractState.characters.extracting}
                          className={cn(
                            "flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium",
                            "hover:bg-muted/50 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                          )}
                        >
                          {extractState.characters.extracting ? (
                            <span className="animate-pulse">
                              {extractState.characters.phase === "fetching" ? "Fetching video…" : "Extracting frames…"}
                            </span>
                          ) : (
                            <>
                              <Film className="h-4 w-4" />
                              Extract character snapshots
                            </>
                          )}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          We&apos;ll fetch this video from YouTube and extract one frame per character. If that fails, you can upload a file instead.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleUploadFallback("characters")}
                          disabled={extractState.characters.extracting}
                          className="text-xs text-primary hover:underline disabled:opacity-60"
                        >
                          Or upload a file
                        </button>
                        {extractState.characters.error && (
                          <p className="text-sm text-destructive">{extractState.characters.error}</p>
                        )}
                      </>
                    )}
                    {analytics.characters.map((char, idx) => (
                      <div key={idx} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                        <p className="text-sm font-medium text-foreground break-words">{char.name}</p>
                        <ul className="list-none space-y-2">
                          {char.scenes.map((scene, sceneIdx) => (
                            <li key={sceneIdx} className="flex min-w-0 flex-col gap-0.5 text-sm">
                              <span className="text-xs font-medium text-muted-foreground">
                                {scene.part}
                              </span>
                              <p className="text-foreground break-words whitespace-pre-wrap">{scene.description}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {analytics.places && analytics.places.length > 0 && (
                <CollapsibleSection
                  label="Places"
                  defaultOpen={false}
                  headerHint={`${analytics.places.length} place${analytics.places.length !== 1 ? "s" : ""}`}
                  headerHintClassName="text-primary"
                >
                  <div className="flex min-w-0 flex-col gap-4 pt-2">
                    {onSetPlaceSnapshots && (
                      <>
                        <input
                          ref={(el) => { fileInputRefs.current.places = el; }}
                          type="file"
                          accept="video/*"
                          className="sr-only"
                          aria-label="Select video file for place frame extraction"
                          onChange={(e) => handleFileChange("places", e)}
                          disabled={extractState.places.extracting}
                        />
                        <button
                          type="button"
                          onClick={() => handleExtractFromVideo("places")}
                          disabled={extractState.places.extracting}
                          className={cn(
                            "flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium",
                            "hover:bg-muted/50 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                          )}
                        >
                          {extractState.places.extracting ? (
                            <span className="animate-pulse">
                              {extractState.places.phase === "fetching" ? "Fetching video…" : "Extracting frames…"}
                            </span>
                          ) : (
                            <>
                              <Film className="h-4 w-4" />
                              Extract place snapshots
                            </>
                          )}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          We&apos;ll fetch this video from YouTube and extract one frame per place. If that fails, you can upload a file instead.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleUploadFallback("places")}
                          disabled={extractState.places.extracting}
                          className="text-xs text-primary hover:underline disabled:opacity-60"
                        >
                          Or upload a file
                        </button>
                        {extractState.places.error && (
                          <p className="text-sm text-destructive">{extractState.places.error}</p>
                        )}
                      </>
                    )}
                    {analytics.places.map((place, idx) => (
                      <div key={idx} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                        <p className="text-sm font-medium text-foreground break-words">{place.name}</p>
                        <ul className="list-none space-y-2">
                          {place.scenes.map((scene, sceneIdx) => (
                            <li key={sceneIdx} className="flex min-w-0 flex-col gap-0.5 text-sm">
                              <span className="text-xs font-medium text-muted-foreground">
                                {scene.part}
                              </span>
                              <p className="text-foreground break-words whitespace-pre-wrap">{scene.description}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
