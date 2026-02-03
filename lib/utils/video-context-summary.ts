/**
 * Builds a single summary string from video analytics (and optional channel) for use
 * as image-generation context (e.g. custom instructions, clipboard).
 * No LLM; formats existing fields into a readable block.
 */

import type { YouTubeVideoAnalytics } from "@/lib/services/youtube-video-analyze";

const CHANNEL_DESCRIPTION_MAX_LENGTH = 400;

export interface ChannelForContext {
  title: string;
  description?: string;
}

/**
 * Builds a video-understanding context string from analytics, video title, and optional channel.
 * Suitable for custom instructions and image generation prompts.
 */
export function buildVideoUnderstandingSummary(
  analytics: YouTubeVideoAnalytics,
  videoTitle: string,
  channel?: ChannelForContext | null
): string {
  const parts: string[] = [];

  if (channel?.title) {
    let channelBlock = `Channel: ${channel.title}.`;
    if (channel.description?.trim()) {
      const desc = channel.description.trim();
      const truncated =
        desc.length > CHANNEL_DESCRIPTION_MAX_LENGTH
          ? desc.slice(0, CHANNEL_DESCRIPTION_MAX_LENGTH) + "…"
          : desc;
      channelBlock += ` ${truncated}`;
    }
    parts.push(channelBlock);
  }

  parts.push(`Video: ${videoTitle}.`);
  parts.push(analytics.summary.trim());

  const meta: string[] = [];
  if (analytics.topic?.trim()) meta.push(`Topic: ${analytics.topic}`);
  if (analytics.content_type?.trim()) meta.push(`Content type: ${analytics.content_type}`);
  if (analytics.tone?.trim()) meta.push(`Tone: ${analytics.tone}`);
  if (analytics.duration_estimate?.trim()) meta.push(`Pacing: ${analytics.duration_estimate}`);
  if (meta.length > 0) parts.push(meta.join(". "));

  if (analytics.key_moments?.trim()) parts.push(`Key moments: ${analytics.key_moments.trim()}`);
  if (analytics.hooks?.trim()) parts.push(`Hooks: ${analytics.hooks.trim()}`);
  if (analytics.thumbnail_appeal_notes?.trim())
    parts.push(`Thumbnail appeal: ${analytics.thumbnail_appeal_notes.trim()}`);

  if (analytics.characters?.length) {
    const names = analytics.characters.map((c) => c.name).join(", ");
    parts.push(`Characters: ${names}.`);
  }
  if (analytics.places?.length) {
    const names = analytics.places.map((p) => p.name).join(", ");
    parts.push(`Places: ${names}.`);
  }

  return parts.filter(Boolean).join("\n\n");
}
