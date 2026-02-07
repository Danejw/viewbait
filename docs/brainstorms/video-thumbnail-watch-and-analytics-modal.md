# Brainstorm: Video Thumbnail Click → Watch & Analytics Modal

This document outlines three distinct architectural paths so that when a user clicks on a video thumbnail, a modal opens where they can play the video in-app and see YouTube Analytics API metrics (views, watch time, traffic sources, etc.) below the player.

---

## Context (from codebase)

- **Thumbnail click**: In `components/studio/youtube-video-card.tsx`, `handleClick` opens the video on YouTube in a new tab (or toggles selection when in selection mode). There is no in-app player.
- **"Video analytics" action**: A separate HoverCard action calls `onRequestVideoAnalytics` and opens `YouTubeVideoAnalyticsModal`, which shows **Gemini** video-understanding analytics (summary, topic, characters, hooks, etc.), not YouTube Analytics API metrics. The modal shows a thumbnail strip and "Watch on YouTube" link, no embed.
- **YouTube Analytics API**: `lib/services/youtube.ts` already exposes per-video helpers: `fetchPerVideoAnalytics`, `fetchVideoAnalyticsTimeSeries`, `fetchVideoTrafficSources`, `fetchVideoImpressions`. The route `app/api/youtube/videos/analytics/route.ts` returns the **latest 10** videos with full analytics (used elsewhere); there is **no single-video** endpoint like `GET /api/youtube/videos/[id]/analytics`.
- **Studio state**: `components/studio/studio-provider.tsx` owns `videoAnalyticsModalOpen`, `videoAnalyticsVideo`, `videoAnalyticsCache` (Gemini analytics), and `onRequestVideoAnalytics`; the existing modal is rendered there.

**Goal**: On thumbnail click, open a modal where the user can **play the video in-app** and see **YouTube Analytics API** metrics for that video below the player (views, watch time, time series, traffic sources, impressions, etc.).

---

## Path 1 — The unified "Watch & Analytics" modal (thumbnail click opens modal)

### Concept

Thumbnail click opens a dedicated modal with an embedded YouTube player and YouTube Analytics API metrics below. Default click no longer opens YouTube in a new tab.

### High-Level Architecture

- **New API**: `GET /api/youtube/videos/[id]/analytics` — accepts `videoId`, uses existing `ensureValidToken`, then calls `fetchVideoDetailsFromDataAPI` + `fetchPerVideoAnalytics` + `fetchVideoAnalyticsTimeSeries` + `fetchVideoTrafficSources` + `fetchVideoImpressions` from `lib/services/youtube.ts` (same helpers used by the bulk route). Returns one `VideoWithAnalytics`-shaped object. Optional short server-side cache (e.g. 5–10 min per video) to avoid repeated calls when reopening the same video.
- **New component**: e.g. `YouTubeVideoWatchAndAnalyticsModal` — receives `videoId`, `title`, `thumbnailUrl`; on open, fetches from `GET /api/youtube/videos/[id]/analytics`. Renders:
  - **Top**: YouTube embed iframe (`https://www.youtube.com/embed/{videoId}`) with responsive aspect ratio.
  - **Below**: Metrics from the API: views, watch time, avg view duration, daily views (time series), traffic sources, impressions/CTR (if available). Reuse existing formatting/patterns (e.g. from `app/api/youtube/videos/analytics/route.ts` types: `VideoWithAnalytics`, `VideoAnalyticsTimeSeries`, `VideoTrafficSource`, `VideoImpressions`).
- **Studio**: New state for "watch & analytics" modal: e.g. `videoWatchAnalyticsModalOpen`, `videoWatchAnalyticsVideo`. On thumbnail click in `youtube-video-card.tsx`, when not in selection mode, call a new action (e.g. `onOpenVideoWatchAnalytics({ videoId, title, thumbnailUrl })`) instead of `window.open(watchUrl)`. Studio provider renders `YouTubeVideoWatchAndAnalyticsModal` and wires the close handler.
- **Dependencies**: No new npm packages; embed is a plain iframe. Auth/scopes: existing YouTube connection used by `/api/youtube/videos/analytics` is sufficient for Analytics API per-video reports.

### Pros & Cons

- **Pros:** Single, clear interaction (click thumbnail → watch + metrics in one place). Reuses existing YouTube Analytics helpers and types; one new route and one new modal component.
- **Cons:** Changes default click behavior (no longer "open YouTube in new tab"); users who prefer external watch need a secondary "Open on YouTube" link in the modal (easy to add).

### Complexity Estimate

**Medium** (one new route, one new modal, studio state + card click wiring).

### Strategic Fit

Best when the product goal is "click thumbnail to watch and see numbers here" as the primary behavior.

---

## Path 2 — Thumbnail opens YouTube; "Watch & Analytics" is a separate action

### Concept

Keep thumbnail click opening YouTube in a new tab. Add a new action (e.g. "Watch & analytics" or "Play & metrics") that opens the same Watch & Analytics modal (embedded player + YouTube Analytics API metrics). Same modal and API as Path 1, different trigger.

### High-Level Architecture

- **Backend**: Same as Path 1 — `GET /api/youtube/videos/[id]/analytics` for single-video analytics.
- **Frontend**: Same `YouTubeVideoWatchAndAnalyticsModal` as Path 1. In the video card, add a new HoverCard/Popover action (e.g. "Watch & analytics") that calls something like `onOpenVideoWatchAnalytics({ videoId, title, thumbnailUrl })`. Thumbnail `handleClick` is unchanged: `window.open(watchUrl)` when not in selection mode.
- **Studio**: Same new state and rendering as Path 1, but only opened from the new action, not from thumbnail click.

### Pros & Cons

- **Pros:** No change to current thumbnail click; power users get in-app watch + metrics via an explicit action. Same implementation as Path 1 for modal and API.
- **Cons:** Two ways to "watch" (external vs modal); the new modal may be less discoverable than making it the click target.

### Complexity Estimate

**Medium** (same as Path 1; only difference is what triggers the modal).

### Strategic Fit

Best when you want to preserve "click = open on YouTube" and add an optional in-app experience without changing default behavior.

---

## Path 3 — Extend existing Video Analytics modal (player + YouTube Analytics API + Gemini)

### Concept

Reuse the existing `YouTubeVideoAnalyticsModal` and add (1) an embedded YouTube player at the top and (2) a section for YouTube Analytics API metrics (views, watch time, time series, traffic sources, impressions). The modal would show both Gemini "video understanding" content and YouTube Analytics API numbers. Thumbnail click could open this extended modal instead of going to YouTube.

### High-Level Architecture

- **New API**: Same `GET /api/youtube/videos/[id]/analytics` as Path 1 for YouTube Analytics API data.
- **Modal changes**: Extend `YouTubeVideoAnalyticsModal` (or split into two sections in one modal):
  - **Top**: Embedded YouTube iframe (replace or supplement the current thumbnail strip).
  - **Middle**: New "YouTube metrics" collapsible section: request `/api/youtube/videos/[id]/analytics` when modal opens (or when videoId is set); display views, watch time, avg duration, time series chart, traffic sources, impressions/CTR. Use the same types as the bulk analytics route.
  - **Below**: Keep existing Gemini sections (Summary, Topic/tone, Key moments, Hooks, etc.) as today.
- **Trigger**: Either thumbnail click opens this modal (and optionally triggers Gemini analysis if not cached), or a single "Video analytics" action that opens the modal and loads both Gemini + YouTube Analytics API. Studio already has `onRequestVideoAnalytics` and Gemini cache; you'd add fetching of YouTube Analytics API data inside the modal or via provider when opening for this video.

### Pros & Cons

- **Pros:** One modal for "everything about this video" (play + Gemini insights + YouTube numbers). No new modal component; one place for all video detail.
- **Cons:** Modal becomes heavier (two data sources, more UI). Gemini analytics are optional/cached; YouTube Analytics API is per-open or cached separately. Risk of crowding the existing modal and mixing two different "analytics" meanings (AI vs platform metrics).

### Complexity Estimate

**Medium–High** (extend existing modal, add API, possibly refactor how "video analytics" is requested so the same open flow can request both Gemini and YouTube Analytics API).

### Strategic Fit

Best when you want a single "video detail" surface and are okay with a denser modal that combines playback, AI insights, and platform metrics.

---

## Recommended starting point

- **Path 1** is the best fit for the stated goal ("when a user clicks on one of the video thumbnails, I want a modal to pop up where we can view the video, play it here, and see the analytics"). It gives a clear, dedicated "watch + numbers" experience and reuses existing backend patterns. Add an "Open on YouTube" link in the modal for users who prefer the full site.
- **Path 2** is a low-risk variant if you want to keep "click thumbnail → YouTube" and add "Watch & analytics" as an explicit action.
- **Path 3** is reasonable only if you want to merge "video understanding" and "platform metrics" into one modal and accept a heavier, two-source UI.

**Implementation order (for Path 1):**

1. Add `GET /api/youtube/videos/[id]/analytics` using existing `fetchVideoDetailsFromDataAPI` and per-video analytics helpers from youtube.ts; return a single `VideoWithAnalytics`-shaped object (optional short cache).
2. Implement `YouTubeVideoWatchAndAnalyticsModal`: embed iframe + metrics section, fetch from the new route when opened, handle loading/error.
3. In studio-provider, add state and action for opening this modal (e.g. `videoWatchAnalyticsModalOpen`, `videoWatchAnalyticsVideo`, `onOpenVideoWatchAnalytics`), and render the new modal.
4. In youtube-video-card, change thumbnail `handleClick` (when not in selection mode) to call `onOpenVideoWatchAnalytics` instead of `window.open(watchUrl)`; keep "Open on YouTube" inside the modal.
