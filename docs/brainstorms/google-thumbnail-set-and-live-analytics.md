# Brainstorm: Google-Connected Thumbnail Set and Live Thumbnail Analytics

This document outlines three distinct architectural paths so that when users are connected with their Google account, they can set (or change) video thumbnails and trigger live thumbnail analytics.

---

## Context (from codebase)

- **Google connection**: Supabase Auth + Google OAuth; tokens in `youtube_integrations`. Scopes include `youtube.force-ssl` for thumbnail upload. Connect/Reconnect in Studio use the same flow. See [google_signin.md](../google_signin.md).
- **Set thumbnail**: `POST /api/youtube/videos/[id]/set-thumbnail` accepts `thumbnail_id` or `image_url`. Requires Pro, connected, and `hasThumbnailScope`. On success it calls `recordPromotion()` which ends the current live period for (user, video) and inserts a new one; metrics for the *ended* period are fetched in the background (`app/api/youtube/videos/[id]/set-thumbnail/route.ts`, `lib/services/live-thumbnail.ts`).
- **UI**: `canSetThumbnail` = Pro + connected + thumbnail scope (`StudioViewYouTube.tsx`). Video card shows "Use thumbnail for this video" → `SetThumbnailPicker` → `setVideoThumbnail()`; `onThumbnailSetSuccess` refetches videos. Gallery can open `SetOnYouTubeModal` to pick a video and set a thumbnail. When connected but scope missing, a dismissible banner suggests Reconnect.
- **Live analytics**: `thumbnail_live_periods` stores one row per promotion; `ended_at` null = still live. `ThumbnailLivePerformanceBlock` in the thumbnail view modal shows periods (video, date range, views, watch time, CTR). Metrics are only fetched when a period *ends* (next time user sets another thumbnail on that video); the *current* live period has no metrics until then.

---

## Path 1 — The Polish Path (Visibility and correctness)

### Concept

Harden the existing flow so that when connected (Pro + scope), set/change thumbnail is obvious and every set reliably triggers live period tracking and analytics. No new APIs; fix edge cases and improve discoverability.

### High-Level Architecture

- **Backend**: No new routes. Ensure set-thumbnail always calls `recordPromotion` when `thumbnail_id` is present (already true). Optionally pass `video_title` from client so new period has a title without an extra fetch.
- **Frontend**: (1) Make "Use thumbnail for this video" more visible when `canSetThumbnail` (e.g. primary CTA or badge on card). (2) After successful set, toast: "Thumbnail set. View performance in thumbnail details" with optional action to open that thumbnail's view modal. (3) Invalidate `["thumbnail-live-periods", thumbnailId]` after set so the view modal shows the new period. (4) Recheck scope detection and Reconnect CTA (SCOPE_REQUIRED handling already exists in set-thumbnail-picker and set-on-youtube-modal).
- **Live analytics**: Keep current behavior (metrics for ended periods only). Ensure ThumbnailLivePerformanceBlock is shown in the thumbnail view modal and refetches after a set so the new "Live on video X" row appears immediately.

### Pros & Cons

- **Pros:** Low risk; aligns with current architecture; improves UX and confidence that set + analytics work.
- **Cons:** Does not show metrics for the *current* live thumbnail until it's replaced.

💡 **Insight:** The codebase already supports both set and change (same API + recordPromotion). The main gaps are visibility and post-set feedback linking to live performance.

⚖ **Trade-off:** Fast to deliver and validates the pipeline without new analytics behavior; defers "live metrics for current thumbnail" to a later path.

### Complexity Estimate

**Low**

### Strategic Fit

Best when the goal is to "make sure" the existing flow works and is discoverable, without adding new analytics behavior. Delivers confidence that set → recordPromotion → show period in ThumbnailLivePerformanceBlock is reliable before adding more features.

---

## Path 2 — The Change-Friendly Path (Explicit change and comparison)

### Concept

Treat "change thumbnail" as a first-class action when a video already has a ViewBait thumbnail live, and help users compare performance across thumbnails over time.

### High-Level Architecture

- **Data**: Already supported: each set-thumbnail call ends the previous period and creates a new one. No schema change.
- **Backend**: Optional: endpoint or extend existing to return "current live thumbnail" per video (e.g. from `thumbnail_live_periods` where `ended_at IS NULL` and `video_id` in list). Used to show "Currently using: [thumb]" on the video card.
- **Frontend**: (1) On YouTube video cards, if the video has an active live period, show which ViewBait thumbnail is currently live (e.g. small thumbnail + "Change" button). (2) "Change thumbnail" opens the same SetThumbnailPicker with copy like "Replace current thumbnail" and same API. (3) Thumbnail view modal or a dedicated "Performance" view: list periods for this thumbnail with date range and metrics (views, CTR); optionally compare multiple thumbnails that were used on the same video (query by video_id).
- **Live analytics**: Same as today (metrics when period ends). Comparison is over historical periods.

### Pros & Cons

- **Pros:** Clear mental model (set vs change); supports A/B-style comparison.
- **Cons:** Requires knowing "current thumbnail per video" (query or cache). Slightly more UI.

💡 **Insight:** The same set-thumbnail API already implements "change"—each call ends the previous period and starts a new one. Path 2 is mostly UX and optional backend to surface "what's live now" on the card.

⚖ **Trade-off:** More discoverable "change" flow and comparison views vs. extra query/cache and UI surface.

### Complexity Estimate

**Medium**

### Strategic Fit

Best when the product goal is to emphasize testing and swapping thumbnails and comparing results. Builds on Path 1 once the base flow is solid.

---

## Path 3 — The Analytics-First Path (Live metrics for current thumbnail)

### Concept

Trigger and surface live thumbnail analytics for the *current* (active) period, not only for ended periods, so users see early performance of the thumbnail that is live now.

### High-Level Architecture

- **Backend**: (1) Extend `fetchAndStoreMetricsForPeriod` (or add a variant) to support *active* periods: use `started_at` to yesterday (or today) as the date range and update the same row. (2) New: `POST /api/thumbnails/[id]/live-periods/refresh` (or similar) that finds the active period(s) for this thumbnail and triggers metrics fetch for them. (3) Optional: cron job that periodically updates metrics for all active periods (e.g. daily) so numbers appear without user action.
- **Frontend**: (1) In ThumbnailLivePerformanceBlock, for the active period row show "Live now" and a "Refresh metrics" button that calls the refresh endpoint and invalidates the query. (2) After setting a thumbnail, optionally auto-open the thumbnail view modal and show "Live on video X" with a note that metrics will appear after 24–48 hours or when refreshed. (3) Optionally show a simple "early" metric (e.g. views since start) when the backend supports it.
- **Live analytics**: Active period gets metrics_fetched_at and views/impressions/CTR updated on demand or on a schedule; UI shows them in the same block.

### Pros & Cons

- **Pros:** Users see performance of the *current* thumbnail without having to replace it.
- **Cons:** YouTube Analytics can have 24–48h delay; need to handle partial/empty metrics and rate limits.

💡 **Insight:** Today metrics are only fetched when a period ends. This path adds on-demand (and optionally scheduled) fetch for the active period so "Live on video X" can show views/CTR for the thumbnail that is live right now.

⚖ **Trade-off:** Better visibility into current thumbnail performance vs. API delay, rate limits, and more backend surface (refresh endpoint, optional cron).

### Complexity Estimate

**Medium–High**

### Strategic Fit

Best when the main ask is "trigger live thumbnail analytics" and show results for the thumbnail that is live right now. Can follow Path 1 (and optionally Path 2) once the set/change flow and period display are validated.

---

## Recommended Starting Point

**Path 1 (The Polish Path)** is the best starting point:

1. The codebase already supports set and change (same API + recordPromotion). The main gaps are visibility (clear that setting/changing is available when connected) and post-set feedback (linking to live performance).
2. Path 2 and Path 3 build on a solid, well-understood flow; doing Path 1 first reduces risk and validates that "set → recordPromotion → show period in ThumbnailLivePerformanceBlock" is reliable before adding "current thumbnail on card" or "refresh metrics for active period."
3. Delivering Path 1 is fast and satisfies "make sure we can set and change and trigger live analytics" in the sense of ensuring the existing trigger (recordPromotion) and display (live periods in modal) work and are discoverable. Path 3 can follow if "live analytics" is explicitly about seeing numbers for the *current* thumbnail.

---

## Roadmap

Execution order for the three paths (Path 1 first, then Paths 2–3 in sequence):

- **Phase 1 (current):** Path 1 — The Polish Path. Visibility, post-set toast with "View performance," optional `video_title`, live-periods invalidation. Ensures set/change and live analytics are discoverable and reliable. See Path 1 above.
- **Phase 2 (next):** Path 2 — The Change-Friendly Path. "Currently using" on video cards, explicit "Change thumbnail," comparison of thumbnail performance over time. See Path 2 above.
- **Phase 3 (after):** Path 3 — The Analytics-First Path. Refresh metrics for active period, optional cron, "Live now" + "Refresh metrics" in ThumbnailLivePerformanceBlock. See Path 3 above.
