"use client";

/**
 * ThumbnailLivePerformanceBlock
 *
 * Fetches and displays live periods for a thumbnail: "Live on video X" or
 * "Was live on video X from A to B" with views, watch time, CTR when available.
 * Used in the thumbnail view modal footer.
 */

import { useQuery } from "@tanstack/react-query";
import * as thumbnailsService from "@/lib/services/thumbnails";
import type { ThumbnailLivePeriod } from "@/lib/types/database";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function PeriodLine({ period }: { period: ThumbnailLivePeriod }) {
  const videoLabel = period.video_title?.trim() || period.video_id;
  const isLive = period.ended_at == null;

  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">
        {isLive ? "Live on " : "Was live on "}
        <span className="truncate" title={videoLabel}>
          {videoLabel}
        </span>
      </span>
      {!isLive && (
        <span>
          {formatDate(period.started_at)} – {formatDate(period.ended_at)}
        </span>
      )}
      {(period.views != null ||
        period.watch_time_minutes != null ||
        period.impressions != null ||
        period.impressions_ctr_percent != null ||
        period.thumbnail_impressions != null ||
        period.thumbnail_ctr_percent != null) && (
        <span className="flex flex-wrap gap-x-3 gap-y-0">
          {period.views != null && <span>{period.views.toLocaleString()} views</span>}
          {period.watch_time_minutes != null && (
            <span>{Math.round(period.watch_time_minutes)} min watch time</span>
          )}
          {period.impressions != null && (
            <span>{period.impressions.toLocaleString()} impressions</span>
          )}
          {period.impressions_ctr_percent != null && (
            <span>{period.impressions_ctr_percent.toFixed(2)}% CTR</span>
          )}
          {period.thumbnail_impressions != null && (
            <span>{period.thumbnail_impressions.toLocaleString()} thumbnail impressions</span>
          )}
          {period.thumbnail_ctr_percent != null && (
            <span>{period.thumbnail_ctr_percent.toFixed(2)}% thumbnail CTR</span>
          )}
        </span>
      )}
    </div>
  );
}

export interface ThumbnailLivePerformanceBlockProps {
  thumbnailId: string | null
}

export function ThumbnailLivePerformanceBlock({ thumbnailId }: ThumbnailLivePerformanceBlockProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["thumbnail-live-periods", thumbnailId],
    queryFn: () => thumbnailsService.getThumbnailLivePeriods(thumbnailId!),
    enabled: !!thumbnailId,
  });

  if (!thumbnailId) return null;
  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground">
        Loading live performance…
      </div>
    );
  }
  if (error || data?.error) {
    return null; // Fail silently so modal still works
  }
  const periods = data?.periods ?? [];
  if (periods.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">Live performance</span>
      <div className="flex flex-col gap-2">
        {periods.map((p) => (
          <PeriodLine key={p.id} period={p} />
        ))}
      </div>
    </div>
  );
}
