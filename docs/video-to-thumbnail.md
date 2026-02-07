# Video-to-thumbnail intelligence

This doc describes how ViewBait uses video context (transcript-derived analysis) for thumbnail ideation and generation.

## Where video context comes from

- **Video analysis**: `POST /api/youtube/videos/analyze` uses Gemini video understanding to analyze a YouTube video by URL. It returns structured **YouTubeVideoAnalytics**: summary, topic, tone, key_moments, hooks, duration_estimate, thumbnail_appeal_notes, content_type, characters, places. This is the “video context” used across the product. See [youtube-video-analysis-plan.md](youtube-video-analysis-plan.md) for the full attribute set.
- **Analysis is Pro-only** and is triggered from the YouTube tab (e.g. “Video analytics” on a video card). Results can be cached per `videoId` in the client (`videoAnalyticsCache` in the studio provider).

## Thumbnail ideation: suggest concepts from video

- **Suggest-thumbnail-concepts API**: `POST /api/youtube/videos/suggest-thumbnail-concepts` takes `videoId`, `videoTitle`, and `analytics` (from cache or from a prior analyze call). It runs one text-only Gemini call that produces **2–4 thumbnail concept prompts** (short text + optional style hint) from the analytics. Returns `{ concepts: Array<{ text, styleHint? }> }`.
- **Client flow**: On the YouTube video card, “Suggest thumbnail concepts” runs analysis if needed (or uses cache), then calls the suggest API. The UI shows the concepts in a popover; each has a “Use this” action.
- **Pro-only**: Same tier as video analysis.

## How video context is used at generation time

- **Re-roll with video context**: When the user clicks “Re-roll with video context” on a video card, the app sets **thumbnail text** to the video title and **custom instructions** to the full video understanding summary (`buildVideoUnderstandingSummary(analytics, title, channel)`). The thumbnail generator receives this as `title` and `customStyle`; `customStyle` is passed into the image prompt as `style_requirements.additional_notes`, so the image model gets full context.
- **Suggest from video + “Use this”**: When the user picks a suggested concept via “Use this”, the app sets **thumbnail text** to the concept’s `text` and **custom instructions** to the same full video summary (if analytics are cached). So the first generation after picking a concept is fully context-aware: the primary concept is the suggested text, and the image model still receives the full video context in custom instructions.

## Summary

| Piece | Purpose |
|-------|--------|
| Video analysis | Produces summary, hooks, key_moments, thumbnail_appeal_notes, etc. from the video. |
| Suggest-thumbnail-concepts | Turns that analysis into 2–4 one-click concept prompts for the generator. |
| Custom instructions | At generate time, the full video summary is sent as `customStyle` so the image model has full context. |
