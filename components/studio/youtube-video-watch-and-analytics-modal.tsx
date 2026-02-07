"use client";

/**
 * YouTubeVideoWatchAndAnalyticsModal
 *
 * Modal opened when user clicks a video thumbnail. Shows an embedded YouTube player
 * and YouTube Analytics API metrics below (views, watch time, time series,
 * traffic sources, impressions). Fetches from GET /api/youtube/videos/[id]/analytics.
 */

import React, { useEffect, useState, useCallback } from "react";
import { ExternalLink, BarChart3 } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
} from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/lib/utils/format";
import type {
  VideoWithAnalytics,
  VideoAnalyticsTimeSeries,
  VideoTrafficSource,
} from "@/app/api/youtube/videos/analytics/route";

const YOUTUBE_WATCH_URL = "https://www.youtube.com/watch?v=";
const YOUTUBE_EMBED_URL = "https://www.youtube.com/embed/";

export interface VideoWatchAnalyticsInput {
  videoId: string;
  title: string;
  thumbnailUrl: string;
}

export interface YouTubeVideoWatchAndAnalyticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: VideoWatchAnalyticsInput | null;
}

/**
 * Format YouTube Analytics traffic source type for display.
 */
function formatTrafficSourceType(sourceType: string): string {
  const map: Record<string, string> = {
    YT_SEARCH: "YouTube search",
    RELATED_VIDEO: "Suggested videos",
    EXT_URL: "External",
    YT_OTHER_PAGE: "Other YouTube",
    NO_LINK_OTHER: "No link / other",
    NO_LINK_EMBEDDED: "Embedded player",
    NO_LINK_SUBSCRIBER: "Subscribers",
    PLAYLIST: "Playlist",
    HAS_LINK_OTHER: "Other (link)",
  };
  return map[sourceType] ?? sourceType.replace(/_/g, " ").toLowerCase();
}

/**
 * Format duration in seconds to human-readable (e.g. "2m 30s").
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function YouTubeVideoWatchAndAnalyticsModal({
  open,
  onOpenChange,
  video,
}: YouTubeVideoWatchAndAnalyticsModalProps) {
  const [data, setData] = useState<VideoWithAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (videoId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/youtube/videos/${encodeURIComponent(videoId)}/analytics`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Failed to load analytics");
        setData(null);
        return;
      }
      if (json.success && json.video) {
        setData(json.video);
      } else {
        setError("No analytics data");
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && video?.videoId) {
      fetchAnalytics(video.videoId);
    } else if (!open) {
      setData(null);
      setError(null);
    }
  }, [open, video?.videoId, fetchAnalytics]);

  if (!video) return null;

  const watchUrl = `${YOUTUBE_WATCH_URL}${video.videoId}`;
  const embedUrl = `${YOUTUBE_EMBED_URL}${video.videoId}`;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="2xl"
        showCloseButton
        className="max-w-[calc(100vw-2rem)] overflow-x-hidden"
      >
        <ModalHeader className="gap-2 min-w-0 pr-8">
          <div className="flex min-w-0 items-center gap-2">
            <BarChart3 className="h-5 w-5 shrink-0 text-muted-foreground" />
            <ModalTitle className="min-w-0 truncate">Watch &amp; analytics</ModalTitle>
          </div>
          <p className="min-w-0 truncate text-muted-foreground text-sm font-normal" title={video.title}>
            {video.title}
          </p>
        </ModalHeader>
        <ModalBody className="min-w-0 gap-4 overflow-hidden pr-1">
          {/* Embedded YouTube player */}
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
            <iframe
              src={embedUrl}
              title={video.title}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Open on YouTube
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Analytics section */}
          <div className="min-w-0 space-y-4">
            <h3 className="text-sm font-medium text-foreground">Analytics (last 28 days)</h3>

            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {error && !loading && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {!loading && !error && data && (
              <div className="min-w-0 space-y-4">
                {/* Key metrics grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricCard label="Views" value={formatCompactNumber(data.viewCount)} />
                  <MetricCard label="Likes" value={formatCompactNumber(data.likeCount)} />
                  <MetricCard label="Comments" value={formatCompactNumber(data.commentCount)} />
                  <MetricCard
                    label="Watch time"
                    value={data.watchTimeMinutes >= 60 ? `${(data.watchTimeMinutes / 60).toFixed(1)}h` : `${Math.round(data.watchTimeMinutes)}m`}
                  />
                  <MetricCard
                    label="Avg view duration"
                    value={formatDuration(data.averageViewDurationSeconds)}
                  />
                  {data.impressions.impressions != null && (
                    <MetricCard
                      label="Impressions"
                      value={formatCompactNumber(data.impressions.impressions)}
                    />
                  )}
                  {data.impressions.impressionsClickThroughRate != null && (
                    <MetricCard
                      label="CTR"
                      value={`${data.impressions.impressionsClickThroughRate.toFixed(2)}%`}
                    />
                  )}
                </div>

                {/* Daily views (time series) */}
                {data.timeSeries.length > 0 && (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Daily views
                    </h4>
                    <div className="max-h-40 overflow-y-auto hide-scrollbar space-y-1">
                      {(data.timeSeries as VideoAnalyticsTimeSeries[])
                        .slice()
                        .reverse()
                        .map((row, i) => (
                          <div
                            key={`${row.date}-${i}`}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground">{row.date}</span>
                            <span className="font-medium">{formatCompactNumber(row.views)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Traffic sources */}
                {data.trafficSources.length > 0 && (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Traffic sources
                    </h4>
                    <div className="space-y-1.5">
                      {(data.trafficSources as VideoTrafficSource[]).map((src, i) => (
                        <div key={`${src.sourceType}-${i}`} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {formatTrafficSourceType(src.sourceType)}
                          </span>
                          <span className="font-medium">{formatCompactNumber(src.views)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  );
}
