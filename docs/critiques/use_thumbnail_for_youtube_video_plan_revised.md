# Use Thumbnail for My Video (YouTube) — Revised Plan

**Based on:** Original plan ([use_thumbnail_for_youtube_video_b756e019.plan.md](c:\Users\RecallableFacts\.cursor\plans\use_thumbnail_for_youtube_video_b756e019.plan.md)) + [Use Thumbnail for YouTube Video Plan Critique](use_thumbnail_for_youtube_video_plan_critique.md).

This revised plan incorporates the critique’s recommendations: delegate the set-thumbnail route to `setVideoThumbnailFromUrl` (fix upload URL once in the service); return a distinct error code (`SCOPE_REQUIRED`) when YouTube returns 403 for insufficient scope so the client can show the reconnect CTA; support `thumbnail_id` in the API from the first iteration for robustness; and note that adding the OAuth scope also unblocks the existing update-title feature.

---

## Context and constraint: "Three thumbnails" vs API

YouTube’s **Test & Compare** (up to 3 thumbnails per video) is a **Studio-only** feature; the **YouTube Data API v3** only supports setting a **single** thumbnail per video via `thumbnails.set`. So we implement:

- **In app:** “Use this thumbnail for my video” = set the chosen image as that video’s **primary** thumbnail on YouTube (the one the API supports).
- **In UX/copy:** We can mention that users can add more thumbnails for A/B testing in YouTube Studio (Test & Compare) if they want; we only set the one via API.

---

## Current state

- **Backend:** [lib/services/youtube.ts](viewbait/lib/services/youtube.ts) has `setVideoThumbnailFromUrl(userId, videoId, imageUrl)` and [app/api/youtube/videos/[id]/set-thumbnail/route.ts](viewbait/app/api/youtube/videos/[id]/set-thumbnail/route.ts) implements `POST` with body `{ image_url }`. Both are **Pro-only**, require YouTube connected, and validate 2MB / JPEG or PNG.
- **Bug:** The thumbnail upload must use the **upload** endpoint. Correct URL: `https://www.googleapis.com/upload/youtube/v3/thumbnails/set`. The YouTube service currently uses `YOUTUBE_DATA_API_BASE` (no `/upload/`), which can cause upload failures. The route duplicates the upload logic; fixing the URL in the **service** and delegating the route to it keeps a single source of truth.
- **OAuth:** [lib/services/auth.ts](viewbait/lib/services/auth.ts) requests only `youtube.readonly` and `yt-analytics.readonly`. Setting thumbnails (and the existing [update-title](viewbait/app/api/youtube/videos/[id]/update-title/route.ts) feature) requires `youtube.upload` or `youtube.force-ssl`. Existing connected users do not have this scope.
- **YouTube tab:** [components/studio/views/StudioViewYouTube.tsx](viewbait/components/studio/views/StudioViewYouTube.tsx) shows channel + grid of [YouTubeVideoCard](viewbait/components/studio/youtube-video-card.tsx) and [RecentThumbnailsStrip](viewbait/components/studio/recent-thumbnails-strip.tsx). The card action bar has “Use title”, “Open on YouTube”, “Re-roll”, “Analyze style”, “Video analytics”, heatmap, channel consistency — no “Use thumbnail” yet.

> **[CRITIQUE-BASED UPDATE]** Adding `youtube.force-ssl` (or `youtube.upload`) to `YOUTUBE_SCOPES` unblocks **both** set-thumbnail and the existing **update-title** feature; the latter also requires this scope and is currently affected by the same missing scope.

---

## Target UX (video-first, minimal steps)

1. **From the YouTube tab:** User hovers a video card → action bar shows a new action: **“Use thumbnail”** (or “Set thumbnail on YouTube”).
2. **Click “Use thumbnail”:** A small, focused **thumbnail picker** opens (modal or popover) showing the same recent thumbnails as the strip (and optionally a “See all” that switches to Create tab or opens a fuller list). No extra steps before the list.
3. **User selects one thumbnail:** Optional one-line confirm: “Set this as the video thumbnail on YouTube?” → **Confirm** triggers `POST /api/youtube/videos/[videoId]/set-thumbnail` with the chosen thumbnail’s `thumbnail_id` (preferred) or `image_url`.
4. **Result:** Success toast (“Thumbnail updated on YouTube”); optionally refresh the video list so the card shows the new thumbnail. On error: if the API returns **code `SCOPE_REQUIRED`** (or `INSUFFICIENT_SCOPE`), show a clear message and prompt to **reconnect YouTube** to grant thumbnail permission; for other 4xx/5xx, show a generic error or “YouTube limit” for 429.

Design principles: one obvious action, minimal clicks, no unnecessary confirm if we can make the action reversible in spirit (e.g. they can change it again from the same UI or in Studio).

> **[CRITIQUE-BASED UPDATE]** The client must distinguish scope errors from other YouTube errors. The API will return a **distinct** code (e.g. `SCOPE_REQUIRED`) when YouTube’s 403 indicates insufficient permissions, so the client can show the reconnect CTA only in that case.

---

## Implementation plan

### 1. Fix YouTube thumbnail upload URL and delegate route to service

- **Service:** In [lib/services/youtube.ts](viewbait/lib/services/youtube.ts), in `setVideoThumbnailFromUrl`, change the upload URL from `YOUTUBE_DATA_API_BASE + '/thumbnails/set'` to the upload base: `https://www.googleapis.com/upload/youtube/v3/thumbnails/set` (add a constant e.g. `YOUTUBE_UPLOAD_API_BASE` or build from existing base).
- **Route:** In [app/api/youtube/videos/[id]/set-thumbnail/route.ts](viewbait/app/api/youtube/videos/[id]/set-thumbnail/route.ts), **do not** duplicate fetch/validate/upload. Instead: validate request body (see §5 for `image_url` vs `thumbnail_id`); resolve to a single fetchable `imageUrl` (if `thumbnail_id`, load thumbnail with RLS, get storage path, create short-lived signed URL or fetch blob); then call **`setVideoThumbnailFromUrl(user.id, videoId, imageUrl)`**. All upload logic and the correct upload URL live only in the YouTube service.

> **[CRITIQUE-BASED UPDATE]** Delegation is the default: one place for the upload URL and upload behavior, avoiding drift between route and service.

### 2. Add YouTube upload scope and reconnect flow

- **Scopes:** In [lib/services/auth.ts](viewbait/lib/services/auth.ts), add `https://www.googleapis.com/auth/youtube.force-ssl` (or `youtube.upload`) to `YOUTUBE_SCOPES` so new connections can set thumbnails (and use update-title). Document that **existing** users must reconnect to gain thumbnail/update-title write permission.
- **Reconnect for existing users:** When the set-thumbnail API returns **code `SCOPE_REQUIRED`** (or `INSUFFICIENT_SCOPE`), the client should show: “Thumbnail upload requires an extra permission. Reconnect your YouTube account to enable it.” with a button that calls [lib/hooks/useYouTubeIntegration.ts](viewbait/lib/hooks/useYouTubeIntegration.ts) `reconnect()`. Optionally, if `scopesGranted` from the status endpoint is known and does not include the upload scope, show a small “Reconnect to enable thumbnail upload” hint on the YouTube tab.

> **[CRITIQUE-BASED UPDATE]** The API must return a **distinct** code for scope errors so the client can show the reconnect CTA. See §2b below.

#### 2b. Return distinct error code when YouTube returns 403 (insufficient scope)

- In the set-thumbnail route (or in `setVideoThumbnailFromUrl` if it returns a structured result), when the YouTube API response has **status 403**, inspect the error payload (e.g. `errorData.error?.errors?.[0]?.reason` or message text containing “insufficient” / “permission” / “scope”). If it indicates missing permissions, return to the client with **code `SCOPE_REQUIRED`** (or `INSUFFICIENT_SCOPE`) and an appropriate message, instead of the generic `YOUTUBE_API_ERROR`. For other 403 or non-403 YouTube errors, keep returning `YOUTUBE_API_ERROR`. This allows the client to branch on `code === 'SCOPE_REQUIRED'` to show the reconnect CTA.

### 3. Client: set-thumbnail API and thumbnail picker

- **API client:** Add a small client function (e.g. in a new or existing YouTube-related service under `lib/services/`) that calls `POST /api/youtube/videos/[id]/set-thumbnail` with `{ thumbnail_id: string }` (preferred) or `{ image_url: string }`. Handle: **`SCOPE_REQUIRED`** → show reconnect CTA (e.g. toast with action or inline message + reconnect button); **404** (not connected), **TIER_REQUIRED** → existing patterns; other 4xx/5xx → toast with error message; 429 → generic “YouTube limit” if desired.
- **Thumbnail picker component:** Create a minimal, reusable picker (e.g. `SetThumbnailPicker` under `components/studio/`) that:
  - Receives `videoId` and optionally `videoTitle` for confirm copy.
  - Uses studio data (e.g. from `useStudio()`) to list recent/combined thumbnails (reuse `getCombinedThumbnailsList` from [lib/utils/studio-thumbnails.ts](viewbait/lib/utils/studio-thumbnails.ts)).
  - Renders a compact grid or strip of thumbnail options; on select, optionally show a one-line confirm then call the set-thumbnail API with the selected thumbnail’s **`thumbnail_id`** (preferred) so the server resolves the image URL.
  - Shows loading state during the request and success/error toasts.
- **Picker placement:** If the picker is a popover or dialog opened from the video card (which sits inside a HoverCard), ensure the picker is **portaled** and has a **z-index above the HoverCard** so it is not clipped or hidden.

> **[CRITIQUE-BASED UPDATE]** Prefer sending `thumbnail_id` from the picker so the server resolves the image URL; this avoids signed-URL expiry and is more robust than relying on client-supplied URLs.

### 4. Wire “Use thumbnail” into the YouTube tab

- In [components/studio/youtube-video-card.tsx](viewbait/components/studio/youtube-video-card.tsx), add an action button (e.g. “Use thumbnail” with an icon like ImagePlus or Upload) to the existing action bar. Use an accessible label (e.g. “Use thumbnail for this video” or “Set thumbnail on YouTube”). On click, open the thumbnail picker (state or context for “picker open for this videoId”). Pass `videoId` and `videoTitle` into the picker. Keep the card’s existing behavior (selection mode, hover, etc.) unchanged.
- Ensure the picker is only shown when the user is on the YouTube tab and has a connected YouTube account; Pro tier is already enforced by the API.

### 5. Accept `thumbnail_id` in the API (recommended from first iteration)

- In [app/api/youtube/videos/[id]/set-thumbnail/route.ts](viewbait/app/api/youtube/videos/[id]/set-thumbnail/route.ts), allow the request body to contain **either** `image_url` **or** `thumbnail_id` (at least one required). If **`thumbnail_id`** is provided: load the thumbnail row with RLS (user must own it); get storage path from `image_url` or derive from `user_id`/`thumbnail_id`; create a short-lived signed URL server-side (or read the object with service role) to obtain a fetchable URL; then pass that URL to `setVideoThumbnailFromUrl(user.id, videoId, imageUrl)`. If **`image_url`** is provided, validate and pass through to `setVideoThumbnailFromUrl` as today (for backward compatibility or when client has a long-lived URL). This avoids client passing expired signed URLs and is the recommended path for the picker.

> **[CRITIQUE-BASED UPDATE]** `thumbnail_id` is recommended from the first iteration for robustness (studio list may use shorter-lived signed URLs); the route already delegates to the service, so resolution logic lives in the route before calling the service.

### 6. Copy and edge cases

- **Empty thumbnails:** If the user has no thumbnails, the picker shows “Create a thumbnail in the Create tab first” with a link to switch view.
- **Success:** Toast: “Thumbnail updated on YouTube.” Optionally invalidate or refetch the YouTube video list so the card’s thumbnail image updates (channel/videos endpoint returning fresh thumbnail URLs allows the card to reflect the new image).
- **Rate limits / quota:** YouTube quota applies (e.g. 50 units per thumbnails.set). For v1, a generic “YouTube limit” or error message on 403/429 is sufficient; no extra UI required.

### 7. Optional improvements (post–v1 or as time allows)

- **Analytics:** Log a non-PII event (e.g. `youtube_thumbnail_set`) when the feature succeeds to measure adoption.
- **Accessibility:** Ensure the picker is keyboard-navigable and that success/error toasts and selected thumbnail are announced for screen readers.

---

## Flow summary (mermaid)

```mermaid
sequenceDiagram
  participant User
  participant YouTubeCard
  participant Picker
  participant API
  participant YouTube

  User->>YouTubeCard: Hover video, click "Use thumbnail"
  YouTubeCard->>Picker: Open picker(videoId, title)
  Picker->>Picker: Show recent thumbnails (studio data)
  User->>Picker: Select thumbnail, confirm
  Picker->>API: POST /api/youtube/videos/:id/set-thumbnail (thumbnail_id)
  API->>API: Auth, Pro, YouTube connected; resolve thumbnail_id to URL
  API->>YouTube: setVideoThumbnailFromUrl (upload URL)
  YouTube-->>API: 200 or 403
  alt 403 scope
    API-->>Picker: code SCOPE_REQUIRED
    Picker->>User: Reconnect CTA
  else success
    API-->>Picker: success
    Picker->>User: Toast; close picker
    Optional->>YouTubeCard: Refetch videos to show new thumbnail
  end
```

---

## Files to touch (summary)

| Area | File(s) |
|------|--------|
| Upload URL fix | [lib/services/youtube.ts](viewbait/lib/services/youtube.ts) only (route delegates to service) |
| Route delegation + thumbnail_id + SCOPE_REQUIRED | [app/api/youtube/videos/[id]/set-thumbnail/route.ts](viewbait/app/api/youtube/videos/[id]/set-thumbnail/route.ts) |
| OAuth scope | [lib/services/auth.ts](viewbait/lib/services/auth.ts) |
| Reconnect on SCOPE_REQUIRED | Set-thumbnail client + picker (check `code === 'SCOPE_REQUIRED'` and show reconnect CTA) |
| API client | New or existing `lib/services/` (e.g. `youtube-set-thumbnail.ts` or under `youtube-*.ts`) |
| Picker UI | New `components/studio/set-thumbnail-picker.tsx` (or similar); portal + z-index above HoverCard |
| YouTube card | [components/studio/youtube-video-card.tsx](viewbait/components/studio/youtube-video-card.tsx) (add button + picker state + accessible label) |

---

## Out of scope for v1

- **Test & Compare (3 thumbnails):** Not possible via public API; we only set the single primary thumbnail. No need to mention “one of three” in the UI unless we add a short tooltip that they can add more in Studio.
- **“From thumbnail” flow:** “Use this thumbnail on YouTube” from a ThumbnailCard (choose video) can be a later phase; video-first flow is enough for a first release.
