# Brainstorm: Faster, More Synchronized Share Click Counts

**Goal:** Make the connection from "click in shared project gallery" → "database updated" → "dashboard shows new count" feel quicker and more synchronized.

**Current flow (brief):**
- **Shared gallery** (`/p/[slug]`): User clicks thumbnail → `recordSharedProjectClick(slug, thumbnail.id)` fires a POST to `/api/projects/share/[slug]/click` (fire-and-forget). API validates slug + thumbnail, then calls Supabase RPC `increment_thumbnail_share_click_count`.
- **Dashboard (studio):** Thumbnails come from `useThumbnails` (React Query infinite query). There is **no refetchInterval** and **no Realtime subscription** for thumbnails. Counts update only when the user triggers a refetch (e.g. change sort/project, manual refresh, or after a mutation that invalidates thumbnail queries).

**Relevant code:**
- Click recording: `viewbait/lib/services/projects.ts` (`recordSharedProjectClick`), `viewbait/app/api/projects/share/[slug]/click/route.ts`
- Shared gallery UI: `viewbait/app/p/[slug]/page.tsx`
- Dashboard data: `viewbait/lib/hooks/useThumbnails.ts`, `viewbait/components/studio/studio-provider.tsx` (consumes thumbnails), `viewbait/components/studio/studio-results.tsx` / gallery views
- Existing Realtime pattern: `viewbait/lib/hooks/useNotifications.ts` (Supabase `channel().on('postgres_changes', ...)`)

---

## Path 1: The Realtime Path

**Concept:** Push-based updates so the dashboard sees new click counts as soon as the database changes.

**High-level architecture:**
- Enable **Supabase Realtime** for the `thumbnails` table (or a minimal replication set: e.g. `share_click_count` changes only, if supported).
- Add a **client-side hook** (e.g. `useThumbnailsRealtime` or extend studio provider) that:
  - Uses the existing Supabase browser client (`createClient()` from `@/lib/supabase/client`).
  - Subscribes to `postgres_changes` on `thumbnails` with a filter so only rows the current user owns (or only rows in the current project/list) trigger updates.
  - On `UPDATE` where `share_click_count` changed, either:
    - **Option A:** Invoke `queryClient.invalidateQueries({ queryKey: thumbnailsQueryKeys.all })` (or the specific list key) so React Query refetches, or
    - **Option B:** Use `queryClient.setQueryData` to patch the cached list with the new `share_click_count` for that thumbnail ID (no refetch, minimal payload).
- Scope the subscription to the authenticated user (e.g. filter by `user_id = auth.uid()` in the Realtime filter if supported, or subscribe and ignore events for other users’ thumbnails in app code).
- Only run the subscription when the studio is on a view that shows thumbnails (e.g. generator, gallery) to avoid unnecessary connections.

**Pros:**
- Dashboard updates **immediately** after the DB is updated (no polling delay).
- No extra HTTP polling requests; efficient once the Realtime connection is open.
- Matches the existing pattern used for notifications (`useNotifications.ts`).

**Cons:**
- Requires enabling Realtime replication for `thumbnails` in Supabase (Dashboard → Database → Replication). May increase Realtime message volume if many columns/tables are replicated.
- RLS / Realtime: Realtime events are delivered based on Supabase’s replication; you must ensure the client only subscribes to changes for rows the user is allowed to see (filter by `user_id` or similar).
- Slightly more moving parts (subscription lifecycle, reconnection, and cache update logic).

**Complexity:** Medium (Realtime config + new hook + wiring in studio).

**Strategic fit:** Choose this when you want the dashboard to feel “live” and you’re comfortable enabling Realtime on `thumbnails` and maintaining a subscription when the gallery is visible.

---

## Path 2: The Polling Path

**Concept:** Keep the current request/response model and make the dashboard refetch thumbnail lists periodically when the user is looking at them.

**High-level architecture:**
- Add a **refetchInterval** to the thumbnail list query **only when the studio view is one that shows the thumbnail grid** (e.g. generator, gallery). For example:
  - In `useThumbnails` (or where it’s consumed), pass an option like `refetchIntervalWhenActive?: number`.
  - When the current view is generator or gallery, use `refetchInterval: 15_000` (15s) or `30_000` (30s); otherwise `refetchInterval: false`.
- Optionally enable **refetchOnWindowFocus** for the thumbnail query so when the user returns to the dashboard tab (e.g. after clicking in the share link in another tab), a refetch runs immediately.
- No changes to the click API or shared gallery page; no new infrastructure.

**Pros:**
- **Very simple** to implement: one or two options in the existing React Query setup and a view-dependent refetch interval.
- No Supabase Realtime, no new endpoints, no new services.
- Predictable: counts appear within at most one interval (e.g. 15s).

**Cons:**
- Not instant; there is a delay up to the interval length.
- Extra requests every N seconds while the user is on the gallery (can tune interval to balance freshness vs. load).

**Complexity:** Low.

**Strategic fit:** Best when you want a quick win with minimal risk and are okay with 15–30s delay for count updates.

---

## Path 3: The Hybrid / Smart Invalidate Path

**Concept:** Make the click recording feel responsive, return useful data from the API, and use cross-tab or focus-based invalidation so the dashboard refreshes at “smart” moments.

**High-level architecture:**
- **Click API:** Keep current behavior; optionally extend the response to return the new count, e.g. `204` with `X-Share-Click-Count: 7` header or a JSON body `{ share_click_count: 7 }` for future use (e.g. show on shared page or for optimistic UI). RPC already does the atomic increment; returning the new value may require `RETURNING share_click_count` in the RPC and passing it through the route.
- **Shared gallery:** Continue fire-and-forget for UX; optionally `await` the click request and read the new count if you later want to show “Recorded” or the count on the shared page.
- **Dashboard:**
  - Enable **refetchOnWindowFocus** for thumbnail queries so switching back to the dashboard tab triggers a refetch (user often clicks share link in another tab, then returns).
  - Optionally add a **short refetchInterval** (e.g. 30s) only when the gallery/generator view is active (same idea as Path 2 but combined with focus).
  - **Optional cross-tab signal:** Use **BroadcastChannel** (or shared worker): when the shared gallery page records a click (same browser, possibly different tab), it posts a message (e.g. `{ type: 'share-click-recorded' }`). The dashboard tab (when open) listens and calls `queryClient.invalidateQueries({ queryKey: thumbnailsQueryKeys.all })`. So if the same user has the share link in one tab and the dashboard in another, the dashboard updates soon after they switch back or immediately if the invalidate runs in the background and refetches.
- No Realtime, no new backend services; only small changes to API response, React Query options, and optional BroadcastChannel in the client.

**Pros:**
- **Quick sync in the common case:** User clicks in share tab → switches to dashboard tab → refetchOnWindowFocus gets new counts; optional BroadcastChannel can invalidate even before focus.
- API can return the new count without changing the core flow; enables future optimistic or shared-page UI.
- No Realtime or polling at a fixed interval required (though you can still add a modest refetchInterval as in Path 2).

**Cons:**
- Cross-tab behavior depends on the user having both tabs open; not useful when the click comes from another device or another browser.
- BroadcastChannel is same-origin only; no help for cross-device clicks.

**Complexity:** Low–Medium (API tweak + React Query options + optional BroadcastChannel + optional refetchInterval).

**Strategic fit:** Choose this when you want faster perceived sync without Realtime, with minimal code, and when the main scenario is “same user, share tab + dashboard tab.”

---

## Summary Table

| Path              | Sync speed         | Implementation effort | New infra      | Best when                          |
|-------------------|--------------------|-------------------------|----------------|------------------------------------|
| 1. Realtime       | Instant            | Medium                  | Realtime on DB | You want live counts, same stack   |
| 2. Polling        | 15–30s             | Low                     | None           | You want a quick, safe improvement |
| 3. Hybrid/Invalidate | Focus / cross-tab | Low–Medium              | None           | Same user, two tabs; minimal change |

---

## Recommended Starting Point

- **Start with Path 2 (Polling)** or **Path 3 (Hybrid)**.
  - The codebase already uses React Query and does not currently use Realtime for thumbnails. Adding a **refetchInterval** (and **refetchOnWindowFocus**) when the gallery/generator view is active is the smallest change that makes counts update regularly and when the user returns to the dashboard.
  - Path 3 adds little extra (API returning count, optional BroadcastChannel) for a better “same user, two tabs” experience.

- **Move to Path 1 (Realtime)** once you want truly instant updates and are ready to:
  - Enable Realtime for the `thumbnails` table (or the minimal set needed),
  - Add and maintain a subscription that is scoped to the current user’s thumbnails and only active when the thumbnail list is visible.

**Immediate concrete steps (Path 2 or 3):**
1. In the hook or component that provides thumbnails to the studio (e.g. `useThumbnails` or the studio provider that uses it), add:
   - `refetchOnWindowFocus: true` for the thumbnail list query.
   - When `currentView` is `generator` or `gallery`, set `refetchInterval: 15_000` or `30_000`; otherwise `refetchInterval: false`.
2. (Optional) Extend the click API to return the new `share_click_count` (e.g. in response body or header) for future use.
3. (Optional) In the shared gallery page, use `BroadcastChannel` to post a message after a successful click; in the studio layout or provider, subscribe and invalidate thumbnail queries on that message.

This keeps the connection from shared gallery → DB → dashboard **quicker and more synchronized** with minimal risk and no new infrastructure for the first iteration.
