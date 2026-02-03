"use client";

/**
 * YouTubeVideoAnalyticsModal
 *
 * Displays Gemini video-understanding analytics for a YouTube video in a modal.
 * Shows video thumbnail and title, then rubric attributes (summary, topic, tone,
 * key moments, hooks, duration, thumbnail notes, content type).
 */

import React from "react";
import { BarChart3, ExternalLink } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalBody,
} from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import type { YouTubeVideoAnalytics } from "@/lib/services/youtube-video-analyze";

const YOUTUBE_WATCH_URL = "https://www.youtube.com/watch?v=";

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
}

function RubricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export function YouTubeVideoAnalyticsModal({
  open,
  onOpenChange,
  video,
  analytics,
  loading = false,
  error = null,
}: YouTubeVideoAnalyticsModalProps) {
  if (!video) return null;

  const watchUrl = `${YOUTUBE_WATCH_URL}${video.videoId}`;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="2xl" showCloseButton={true}>
        <ModalHeader className="gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <ModalTitle>Video analytics</ModalTitle>
          </div>
          <p className="text-muted-foreground text-sm font-normal truncate" title={video.title}>
            {video.title}
          </p>
        </ModalHeader>
        <ModalBody className="gap-4">
          {/* Video preview strip */}
          <div className="flex gap-3 rounded-lg overflow-hidden bg-muted/50 p-2">
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
            <div className="grid gap-4 sm:grid-cols-1">
              <RubricRow label="Summary" value={analytics.summary} />
              <div className="grid gap-4 sm:grid-cols-2">
                <RubricRow label="Topic" value={analytics.topic} />
                <RubricRow label="Content type" value={analytics.content_type} />
                <RubricRow label="Tone" value={analytics.tone} />
                <RubricRow label="Duration / pacing" value={analytics.duration_estimate} />
              </div>
              <RubricRow label="Key moments" value={analytics.key_moments} />
              <RubricRow label="Hooks" value={analytics.hooks} />
              <RubricRow label="Thumbnail appeal notes" value={analytics.thumbnail_appeal_notes} />

              {analytics.characters && analytics.characters.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Characters
                  </span>
                  <div className="flex flex-col gap-4">
                    {analytics.characters.map((char, idx) => (
                      <div key={idx} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                        <p className="text-sm font-medium text-foreground">{char.name}</p>
                        <ul className="list-none space-y-2">
                          {char.scenes.map((scene, sceneIdx) => (
                            <li key={sceneIdx} className="flex flex-col gap-0.5 text-sm">
                              <span className="text-xs font-medium text-muted-foreground">
                                {scene.part}
                              </span>
                              <p className="text-foreground whitespace-pre-wrap">{scene.description}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
