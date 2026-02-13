# Network & API Efficiency Audit

Audit of the ViewBait codebase for network and API inefficiencies that affect perceived performance and cost.

---

## Summary Table (Quick Triage)

| # | Status | Impact | Issue | Effect | Link to Section |
|---|--------|--------|-------|--------|-----------------|
| 1 | Open | High | Shared project gallery polls every 60s even when tab is hidden | Requests Reduced ~70–80% when tab in background | [§1](#1-shared-project-gallery-polling-when-tab-hidden) |
| 2 | Open | Medium | Thumbnail live periods query has no staleTime/gcTime; refetches on every modal open | Requests Reduced ~40–60%; Median Latency ~50% (cache hit) | [§2](#2-thumbnail-live-periods-missing-cache-options) |
| 3 | Open | Medium | GET /api/notifications runs two sequential DB queries (list + unread count) | Median Latency ~30–50% for that endpoint | [§3](#3-notifications-list--unread-count-double-round-trip) |
| 4 | Open | High | Video analytics (Gemini analyze) is per-video only; no batching for multiple videos | Requests Reduced ~50–75% if batch of 2–4; lower Gemini cost | [§4](#4-video-analytics-per-video-no-batching) |
| 5 | Open | Medium | API client has no request timeout or retry policy | Median Latency (perceived) via fail-fast; fewer hung requests | [§5](#5-api-client-no-timeout-or-retry) |
| 6 | Open | Medium | Experiment analytics polling continues when tab is hidden | Requests Reduced ~70–80% when tab in background | [§6](#6-experiment-analytics-polling-when-tab-hidden) |
| 7 | Open | Low | Broad invalidateQueries (e.g. styles/palettes) can trigger multiple refetches | Requests Reduced ~20–40% by scoping invalidation | [§7](#7-broad-invalidation-triggers-multiple-refetches) |
| 8 | Open | Low | Thumbnail heatmap / channel consistency are on-demand per card; no batch API | Requests unchanged without batch endpoint; optional future batch | [§8](#8-heatmap-and-consistency-per-card-no-batching) |

---

## 1. Shared project gallery polling when tab hidden

**Location:** `viewbait/lib/hooks/useProjects.ts` — `useSharedProjectGallery`

**Current behavior:**  
`useSharedProjectGallery(slug)` uses `refetchInterval: 60 * 1000` and `staleTime: 60 * 1000` with no check for `document.visibilityState`. The shared gallery page keeps polling every 60s even when the tab is in the background.

**Impact:** Unnecessary requests and load when the user is not viewing the page.

**Recommendation:** Pause polling when the tab is hidden (e.g. `refetchInterval: document.visibilityState === 'hidden' ? false : 60_000`) and optionally refetch once when the tab becomes visible if data is stale.

---

## 2. Thumbnail live periods missing cache options

**Location:** `viewbait/components/studio/thumbnail-live-performance-block.tsx`

**Current behavior:**  
`useQuery` for `["thumbnail-live-periods", thumbnailId]` has no `staleTime` or `gcTime`. It uses the QueryProvider defaults (5m stale, 10m gc). Because the block is mounted when a thumbnail modal opens, repeated open/close of the same thumbnail can still trigger refetches depending on timing; intent is not explicit.

**Impact:** Extra calls to `/api/thumbnails/:id/live-periods` when reopening the same thumbnail modal.

**Recommendation:** Set explicit `staleTime` (e.g. 2–5 minutes) and `gcTime` (e.g. 10 minutes) so live periods are clearly cached and not refetched on every modal open when data is still fresh.

---

## 3. Notifications list + unread count double round-trip

**Location:** `viewbait/app/api/notifications/route.ts` — GET handler

**Current behavior:**  
The handler runs two sequential Supabase queries: (1) list of notifications with `count: 'exact'`, and (2) a separate `count`-only query for unread. Both hit the same table with similar filters.

**Impact:** Two round-trips per GET /api/notifications; higher latency and more DB load.

**Recommendation:** Return unread count from the same query (e.g. window function, subquery, or a single query that returns list + unread count) so one round-trip suffices.

---

## 4. Video analytics per-video only (no batching)

**Location:**  
- `viewbait/components/studio/studio-provider.tsx` — effect that calls `analyzeYouTubeVideo(id)` per video  
- `viewbait/lib/services/youtube-video-analyze.ts` — `analyzeYouTubeVideo(videoId)`  
- `viewbait/app/api/youtube/videos/analyze/route.ts` — per-video analyze

**Current behavior:**  
When the user requests analytics for multiple videos (e.g. opens 3 cards in sequence), the client issues one POST `/api/youtube/videos/analyze` per video. Each call triggers Gemini video understanding independently. There is no batch analyze endpoint.

**Impact:** N requests and N Gemini calls for N videos; higher cost and slower UX when several videos are analyzed.

**Recommendation:** Consider a batch analyze endpoint (e.g. POST body `{ videoIds: string[] }`) that returns analytics for multiple videos, and have the studio provider batch pending video IDs and call it once (or in small batches), then distribute results to the cache.

---

## 5. API client no timeout or retry

**Location:** `viewbait/lib/services/api-client.ts`

**Current behavior:**  
`apiRequest` uses raw `fetch()` with no `AbortSignal`/timeout and no retry. Long-running or stuck requests can hang; transient failures are not retried.

**Impact:** Poor UX on slow networks; no standardized retry for idempotent GETs.

**Recommendation:** Add an optional timeout (e.g. 30s) via `AbortController` and, for GET requests, a simple retry policy (e.g. 1–2 retries with backoff) for 5xx or network errors.

---

## 6. Experiment analytics polling when tab hidden

**Location:** `viewbait/lib/hooks/useExperimentAnalytics.ts`

**Current behavior:**  
`refetchInterval` is set when `enabled` is true but does not depend on `document.visibilityState`. Polling continues every 5 minutes even when the tab is in the background.

**Impact:** Unnecessary requests and load when the user is not viewing the experiment page.

**Recommendation:** Set `refetchInterval` to `false` when `document.visibilityState === 'hidden'`, and use the same pattern as subscription (e.g. longer interval when idle, or pause when hidden).

---

## 7. Broad invalidation triggers multiple refetches

**Location:**  
- `viewbait/lib/hooks/useStyles.ts` — mutations that invalidate `stylesQueryKey`, `publicStylesQueryKey`, and `favoritesQueryKey`  
- `viewbait/lib/hooks/usePalettes.ts` — same pattern

**Current behavior:**  
A single mutation (e.g. toggle favorite) invalidates several query keys. Each invalidated key can trigger a refetch if that query is mounted, so one user action can cause 2–3 refetches.

**Impact:** More requests than necessary; possible UI churn.

**Recommendation:** Invalidate only the query keys that are actually affected by the mutation (e.g. toggle favorite only invalidates favorites list, not necessarily the full list). Use more granular query keys or partial invalidation where possible.

---

## 8. Heatmap and consistency per-card (no batching)

**Location:**  
- `viewbait/components/studio/youtube-video-card.tsx` — heatmap mutation, consistency mutation  
- `viewbait/components/studio/thumbnail-card.tsx` — heatmap mutation  
- `viewbait/lib/services/thumbnail-heatmap.ts`, `viewbait/lib/services/youtube-channel-consistency.ts`

**Current behavior:**  
Heatmap and channel consistency are requested on demand per card and cached in React Query after the first request. There is no batch API to request heatmaps or consistency for multiple items in one call.

**Impact:** If the user opens heatmap/consistency for many cards, N requests are sent. Lower priority than list/analytics batching.

**Recommendation:** Optional future work: add batch endpoints (e.g. POST with multiple image URLs or video IDs) and have the UI request in small batches when multiple cards need data.

---

## Network optimization plan

### Caching rules

- **Public static (e.g. tiers, default styles/palettes):**  
  `staleTime` 5–30 min, `gcTime` 10–60 min; use `createCachedResponse` with `public-static` or `public-semi-static` where applicable.
- **User-owned, semi-static (projects, thumbnails list, styles, palettes, faces):**  
  `staleTime` 2–10 min, `gcTime` 5–30 min; keep existing patterns but ensure no query lacks explicit cache when it’s list/detail.
- **User-owned, dynamic (notifications, subscription, live periods):**  
  `staleTime` 1–2 min, short `maxAge` in cache headers; consider Realtime or visibility-based refetch instead of fixed short polling where possible.
- **Polling (subscription, shared gallery, experiment analytics):**  
  Pause or lengthen interval when `document.visibilityState === 'hidden'`; resume or shorten when visible. Optionally lengthen interval after idle (e.g. no activity for 2+ minutes).

### Request lifecycles

- **List/detail consistency:** When a mutation affects a list (e.g. add/remove favorite), invalidate the list query key that is actually in use; avoid invalidating every related key if only one view is affected.
- **Optimistic updates:** Where possible, update the cache optimistically and only refetch or invalidate on error or when server state must be reconciled.
- **Deduping:** Rely on React Query’s queryKey deduping; ensure query keys include all parameters that affect the response (filters, sort, pagination cursor) so different views don’t share a key when they shouldn’t.

### Retries and timeouts

- **Timeouts:** Add a default request timeout (e.g. 30s) in the API client using `AbortController` and `setTimeout`; expose optional per-call timeout for long-running routes (e.g. generate).
- **Retries:** Keep QueryProvider’s retry for queries (exponential backoff, cap 30s). For the API client, add optional retry for idempotent GETs (1–2 retries on 5xx or network error). Do not retry mutations by default except for defined retryable errors (e.g. 429, 503).

### Measuring improvements

- **Metrics to capture (before/after):**  
  - Number of requests per session (or per page) for key flows: studio load, shared gallery view, notifications panel, experiment page.  
  - P95/P99 latency for GET /api/notifications, GET /api/thumbnails, GET /api/projects.  
  - Number of calls to /api/youtube/videos/analyze per session.  
  - When tab is in background for 5+ minutes: count of polling requests (subscription, shared gallery, experiment analytics).
- **How:**  
  - Use browser Performance API or a small client-side logger that counts fetch calls per route (or query key) and sends a summary (e.g. on unload or to an analytics endpoint).  
  - Server-side: log request duration and route in middleware or in route handlers; aggregate in existing logging/monitoring.  
  - A/B test or staged rollout: enable optimizations for a fraction of users and compare request counts and latency percentiles.

---

## Implementation prompts (for AI coding agent)

Each prompt below is self-contained so an agent can implement the change and validate it with the suggested test.

---

### Prompt 1: Pause shared project gallery polling when tab is hidden

**The Problem**  
The shared project gallery hook polls the API every 60 seconds even when the user has switched to another tab, wasting requests and backend load.

**Current State**  
In `viewbait/lib/hooks/useProjects.ts`, `useSharedProjectGallery` uses:

- `refetchInterval: 60 * 1000`
- `staleTime: 60 * 1000`
- No use of `document.visibilityState`

**Goal State**  
- When `document.visibilityState === 'hidden'`, set `refetchInterval` to `false` (no polling).  
- When the tab becomes visible again, refetch if data is stale (React Query’s default `refetchOnWindowFocus` can do this if the query is still mounted).  
- Keep polling at 60s only while the tab is visible.

**Unit Test (or integration test) to validate request behavior**  
- In a test environment (e.g. jsdom), render a component that uses `useSharedProjectGallery('some-slug')`.  
- Advance timers so that 60s would have passed; with tab “visible,” expect the query to have been refetched (mock fetch and assert call count).  
- Set `document.visibilityState` to `'hidden'` and advance timers again; expect no additional refetch for the same period.  
- Set `document.visibilityState` back to `'visible'` and trigger a refetch-on-focus; expect one refetch when data is stale.

**Implementation Prompt**  
Update `useSharedProjectGallery` in `viewbait/lib/hooks/useProjects.ts` so that polling runs only when the tab is visible. Use a function for `refetchInterval` that returns `false` when `document.visibilityState === 'hidden'` and returns `60 * 1000` otherwise. Rely on `refetchOnWindowFocus: true` (or default) so that when the user returns to the tab, a refetch runs if the data is stale. Ensure the hook does not cause React hydration issues (guard `document`/`window` if running on server). Add or extend a test that mocks visibility and timers and asserts that refetches occur only when the tab is visible and that one refetch occurs on focus when stale.

---

### Prompt 2: Add staleTime and gcTime to thumbnail live periods query

**The Problem**  
Opening and reopening the same thumbnail’s modal can trigger repeated requests to `/api/thumbnails/:id/live-periods` because the query has no explicit cache configuration.

**Current State**  
In `viewbait/components/studio/thumbnail-live-performance-block.tsx`, the `useQuery` for `["thumbnail-live-periods", thumbnailId]` has:

- `queryKey: ["thumbnail-live-periods", thumbnailId]`
- `queryFn` calling `thumbnailsService.getThumbnailLivePeriods(thumbnailId!)`
- `enabled: !!thumbnailId`
- No `staleTime` or `gcTime`

**Goal State**  
- Add `staleTime: 2 * 60 * 1000` (2 minutes) so that within 2 minutes, reopening the same thumbnail’s modal does not refetch.  
- Add `gcTime: 10 * 60 * 1000` (10 minutes) so that cached data is kept for 10 minutes after the last observer unmounts.

**Unit Test (or integration test) to validate request behavior**  
- Render `ThumbnailLivePerformanceBlock` with a given `thumbnailId`, mock `thumbnailsService.getThumbnailLivePeriods` to resolve with `{ periods: [...], error: null }`.  
- Assert the service is called once.  
- Unmount the component and mount it again with the same `thumbnailId` within 2 minutes (or advance React Query’s internal clock if testing with fake timers).  
- Assert the service is not called again (cache hit).  
- After advancing time past `staleTime`, trigger a refetch or remount; assert the service is called again.

**Implementation Prompt**  
In `viewbait/components/studio/thumbnail-live-performance-block.tsx`, add to the `useQuery` options: `staleTime: 2 * 60 * 1000` and `gcTime: 10 * 60 * 1000`. Add or extend a test that mocks `getThumbnailLivePeriods` and verifies that (1) the first mount results in one call, (2) a second mount with the same `thumbnailId` within 2 minutes does not call the service again, and (3) after data is stale, a refetch or new mount triggers one more call.

---

### Prompt 3: Single round-trip for GET /api/notifications (list + unread count)

**The Problem**  
GET /api/notifications performs two sequential database queries (list with count, then unread count), which increases latency and load.

**Current State**  
In `viewbait/app/api/notifications/route.ts`, the GET handler:

1. Runs a query for notifications (with `count: 'exact'`) filtered by `user_id`, optional `is_read`/`is_archived`, ordered and ranged.  
2. Runs a second query that only counts unread, non-archived notifications for the same user.

**Goal State**  
Return the same response shape `{ notifications, count, unreadCount }` with at most one main query and one round-trip. Options: (a) use a single query and compute unread count in JS from the result set if the list is unread-only or small; (b) use a database window function or subquery to return total count and unread count with the list; (c) use a raw SQL or RPC that returns list + counts in one call. Prefer (b) or (c) so that unread count is correct even when the list is paginated.

**Unit Test (or integration test) to validate request behavior**  
- Call GET /api/notifications with valid auth and optional `limit`/`offset`.  
- Assert status 200 and response shape `{ notifications, count, unreadCount }`.  
- Assert that `unreadCount` matches the number of unread, non-archived notifications for the user (e.g. from a test DB or mock).  
- Assert that the number of requests or query executions to the DB for that single GET is 1 (or at most 2 if the framework requires a separate count query that cannot be combined).

**Implementation Prompt**  
Refactor GET /api/notifications in `viewbait/app/api/notifications/route.ts` so that the list and unread count are obtained in a single database round-trip. Preserve the existing response shape and cache headers. Add or extend an API/integration test that asserts the response shape and that `unreadCount` is correct and that the handler does not perform two separate list/count queries when one combined query is feasible.

---

### Prompt 4: Batch video analytics (analyze) endpoint and studio usage

**The Problem**  
When the user requests analytics for multiple videos, the app sends one POST /api/youtube/videos/analyze per video, causing N Gemini calls and N network requests.

**Current State**  
- `viewbait/lib/services/youtube-video-analyze.ts` exposes `analyzeYouTubeVideo(videoId)` which POSTs to `/api/youtube/videos/analyze` with `{ videoId }`.  
- `viewbait/components/studio/studio-provider.tsx` has an effect that, for each id in `videoAnalyticsLoadingVideoIds`, calls `analyzeYouTubeVideo(id)` and then updates the cache.  
- The analyze API route processes one video per request.

**Goal State**  
- Add a batch analyze API (e.g. POST /api/youtube/videos/analyze with body `{ videoIds: string[] }`, or a dedicated route) that returns `{ results: { [videoId]: analytics } }` (or an array of `{ videoId, analytics }`).  
- In the studio provider, collect pending video IDs and call the batch endpoint once (or in chunks of e.g. 3–5) instead of calling `analyzeYouTubeVideo` per id.  
- Map the batch response back into `videoAnalyticsCache` and open the modal for the first or requested video.  
- Keep backward compatibility: single-video analyze can still be supported (e.g. batch with one id).

**Unit Test (or integration test) to validate request behavior**  
- Unit: For the batch API, given a mock Gemini/service, assert that a request with `videoIds: ['a','b','c']` results in one call to the external analyzer and returns analytics for all three.  
- Integration: In the studio, trigger “analyze” for three videos in quick succession; assert that only one (or two) network requests are made to the analyze endpoint and that all three videos end up in the analytics cache with correct data.

**Implementation Prompt**  
Implement a batch video analyze flow: (1) Add a batch analyze API that accepts `videoIds: string[]` and returns analytics per video (reuse existing per-video logic in a loop or parallel, respecting rate limits). (2) In the studio provider, replace the per-video `analyzeYouTubeVideo(id)` loop with logic that batches pending IDs (e.g. collect in an effect, then call the batch endpoint once per batch of up to 5), then distributes results to `videoAnalyticsCache` and opens the modal appropriately. (3) Ensure the existing single-video path still works (e.g. batch of one). (4) Add a test that verifies multiple videos result in fewer network calls than N and that cache and modal state are correct.

---

### Prompt 5: API client request timeout and optional retry

**The Problem**  
The shared API client does not set a request timeout or retry policy, so requests can hang and transient failures are not retried.

**Current State**  
In `viewbait/lib/services/api-client.ts`, `apiRequest` uses `fetch(path, options)` with no `signal` (timeout) and no retry. QueryClient in QueryProvider already retries failed queries, but direct service calls (e.g. from mutations or one-off fetches) do not benefit.

**Goal State**  
- Add an optional timeout (e.g. 30 seconds) to `apiRequest` via `AbortController` and `setTimeout`. If the timeout fires, abort the request and return a structured error (e.g. `code: 'TIMEOUT'`).  
- For GET requests only, optionally retry on 5xx or network error (e.g. 1–2 retries with exponential backoff). Do not retry on 4xx (except e.g. 429 if desired).  
- Expose a way to pass a custom timeout or disable retry per call if needed (e.g. for long-running generate/edit endpoints).

**Unit Test (or integration test) to validate request behavior**  
- Timeout: Mock a fetch that never resolves; call `apiGet` with a 100ms timeout; assert the promise rejects with a timeout error and that `AbortController.abort()` was used.  
- Retry: Mock fetch to fail once with 503 then succeed; call `apiGet` with retry enabled; assert that fetch is called twice and the second response is returned.  
- No retry for 4xx: Mock fetch to return 400; assert fetch is called once and the error is returned without retry.

**Implementation Prompt**  
In `viewbait/lib/services/api-client.ts`: (1) Create an `AbortController` and pass its `signal` to `fetch`. Set a timeout (default 30s) that calls `controller.abort()` and clear the timeout when the request settles. (2) For GET requests, on 5xx or network error, retry up to 2 times with exponential backoff (e.g. 1s, 2s), then return the last error. (3) Do not retry on 4xx. (4) Allow optional per-call options to override timeout or disable retry. (5) Add unit tests that mock `fetch` and verify timeout aborts the request and that retries occur for 5xx and not for 4xx.

---

### Prompt 6: Pause experiment analytics polling when tab is hidden

**The Problem**  
Experiment analytics polling runs every 5 minutes even when the user has switched to another tab.

**Current State**  
In `viewbait/lib/hooks/useExperimentAnalytics.ts`, `refetchInterval` is set to the provided value (default 5 minutes) when `enabled` is true, with no check for `document.visibilityState`.

**Goal State**  
When `document.visibilityState === 'hidden'`, set `refetchInterval` to `false`. When the tab is visible again, either rely on `refetchOnWindowFocus` to refetch if stale or keep the same interval. Ensure no polling runs while the tab is hidden.

**Unit Test (or integration test) to validate request behavior**  
- Render a component that uses `useExperimentAnalytics({ videoId: 'v1', enabled: true })` with a mock queryFn.  
- Advance timers by 5 minutes with tab “visible”; assert the queryFn was called (initial + 1 refetch).  
- Set `document.visibilityState` to `'hidden'`, advance timers by 10 minutes; assert no additional queryFn calls.  
- Set `document.visibilityState` back to `'visible'` and, if applicable, trigger refetch on focus; assert one more call when data is stale.

**Implementation Prompt**  
Update `viewbait/lib/hooks/useExperimentAnalytics.ts` so that `refetchInterval` is a function that returns `false` when `document.visibilityState === 'hidden'` and returns the configured interval (e.g. 5 minutes) when visible. Use a state or ref that tracks visibility and updates on the `visibilitychange` event so that React re-renders and the query receives the new interval. Ensure the hook is safe on the server (guard `document`). Add a test that mocks visibility and timers and asserts that refetches occur only when the tab is visible.

---

### Prompt 7: Scope style and palette mutation invalidations

**The Problem**  
Style and palette mutations invalidate multiple query keys at once (e.g. list, public list, favorites), which can trigger 2–3 refetches for a single user action.

**Current State**  
In `viewbait/lib/hooks/useStyles.ts` and `viewbait/lib/hooks/usePalettes.ts`, mutations such as toggle favorite or update call `invalidateQueries` for `stylesQueryKey` / `palettesQueryKey`, `publicStylesQueryKey` / `publicPalettesQueryKey`, and `favoritesQueryKey`.

**Goal State**  
- For “toggle favorite”: invalidate only the favorites list (and the single item’s detail if it’s cached) so that the main list and public list are not refetched unless they include favorite state.  
- For “update” or “delete”: invalidate the list that contains the item and the detail key for that id; invalidate public/favorites only if the mutation affects visibility or favorite state.  
- Avoid invalidating every related key when only one view is affected.

**Unit Test (or integration test) to validate request behavior**  
- With a mock QueryClient that records `invalidateQueries` calls, run “toggle favorite” for a style; assert that the invalidation targets only the favorites query key (and possibly the detail key for that style), not the full styles list or public list.  
- Run “update style”; assert that at least the list and the updated style’s detail are invalidated, and that unrelated keys (e.g. public list if the update doesn’t change public state) are not invalidated.

**Implementation Prompt**  
In `viewbait/lib/hooks/useStyles.ts` and `viewbait/lib/hooks/usePalettes.ts`, change mutation `onSuccess` handlers to invalidate only the query keys that are affected by the mutation. For toggle favorite, invalidate only the favorites query key and the specific item’s detail key. For create/update/delete, invalidate the main list and the affected detail key; invalidate public or favorites only when the mutation changes visibility or favorite state. Add tests that use a spy or mock QueryClient to assert that the set of invalidated keys is minimal and correct for each mutation type.

---

### Prompt 8 (optional): Batch heatmap or consistency API

**The Problem**  
Heatmap and channel consistency are requested on demand per card; there is no batch endpoint to reduce the number of requests when many cards are opened.

**Current State**  
- `thumbnail-heatmap.ts` and `youtube-channel-consistency.ts` call single-item APIs.  
- Cards call these on user action and cache results in React Query by card id.

**Goal State**  
- Add optional batch endpoints, e.g. POST /api/thumbnails/heatmap/batch with `{ imageUrls: string[] }` or `{ thumbnailIds: string[] }`, and POST /api/youtube/channel-consistency/batch with `{ items: { videoId, thumbnailUrl, otherUrls }[] }`.  
- Update the heatmap/consistency services to support batch calls; when multiple cards need data, the UI (or a small scheduler) can batch requests and distribute results to the cache.  
- Keep the single-item API and current per-card flow working; batching is an optimization when multiple items are requested close together.

**Unit Test (or integration test) to validate request behavior**  
- Call the batch heatmap API with 3 image URLs; assert one HTTP request and response with 3 results keyed by id or index.  
- In the UI, trigger heatmap for 3 cards within a short window; assert that either 1 batch request or 3 single requests are made (depending on implementation), and that all 3 cards receive the correct cached data.

**Implementation Prompt**  
(Optional) Design and implement batch endpoints for heatmap and/or channel consistency: (1) Add POST routes that accept multiple items and return results for each. (2) Implement server-side logic that runs the existing single-item logic in parallel or in a loop and returns a map or array of results. (3) Add client helpers that call the batch endpoint when multiple items are requested (e.g. from a queue or when N cards are visible and need data). (4) Ensure backward compatibility with the current per-card flow. (5) Add tests that verify batch response shape and that the client correctly fills the cache for all requested items.

---

*End of audit.*
