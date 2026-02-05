# Move Thumbnail to Project – Investigation & Paths

## Problem Summary

Moving a thumbnail from one project to another (or to "No project") did not behave as expected: it was unclear whether the database updated, and the UI did not reflect the new project.

## Investigation Outcome

**Root cause: backend list response omitted `project_id`.**

- **Database & move API:** The POST `/api/thumbnails/[id]/project` route correctly updates `thumbnails.project_id` and returns the updated row. The DB was updating as intended.
- **List API:** The thumbnails list used a fixed select list `THUMBNAIL_FIELDS` in `lib/server/data/thumbnails.ts` that did **not** include `project_id`. So:
  - Every thumbnail in the list response had no `project_id`.
  - The client maps list items with `mapDbThumbnailToThumbnail`, which sets `projectId: db.project_id ?? null` → always `null` when the field is missing.
  - The UI (e.g. project dropdown on the card, or "current" project label) always showed "No project" and did not update after a move, because refetched list data still lacked `project_id`.
- **Cache invalidation:** After a move, the provider calls `invalidateAllThumbnails()` and `refetchAllThumbnails()`, which invalidate/refetch all thumbnail list queries. That part is correct; the issue was the refetched payload not containing `project_id`.

**Fix applied:** `project_id` was added to `THUMBNAIL_FIELDS` so the list API returns it. After a move, refetch now returns the correct `project_id` and the UI shows the thumbnail in the right project.

---

## Three Paths

### Path 1: The Minimal Fix (Implement this first)

**Concept:** Fix the list payload so the UI has the data it needs; keep the rest of the flow as-is.

**High-level architecture:**

- **Backend:** Add `project_id` to the thumbnails list select in `lib/server/data/thumbnails.ts` (`THUMBNAIL_FIELDS`). No new endpoints or logic.
- **Frontend:** No change. Existing flow (move → `updateThumbnailProject` → invalidate + refetch) already uses the list response; once the list includes `project_id`, `mapDbThumbnailToThumbnail` and the card UI show the correct project.

**Pros & Cons:**

- ✅ Small, low-risk change; aligns with existing patterns.
- ✅ Fixes both “DB not updating” confusion (it was) and “UI not updating” (it was due to missing field).
- ⚖️ Refetch-after-move can still feel slightly delayed on slow networks; no optimistic UI.

**Complexity:** Low

**Strategic fit:** Resolves the bug with minimal code and no new concepts. Best first step.

---

### Path 2: The Responsive Path (Optimistic UI + targeted invalidation)

**Concept:** Keep the list fix, and make the UI feel instant by updating the cache optimistically and ensuring the right queries are invalidated.

**High-level architecture:**

- **Backend:** Same as Path 1 (list returns `project_id`).
- **Frontend:**
  - In `onAddToProject` (studio-provider): before or in parallel with the API call, update React Query cache for all thumbnail list queries: remove the thumbnail from the “source” project list (or “all” if it had no project) and add it to the “target” project list (or remove from list if target is “No project”). Use the same shape as the list API (e.g. `DbThumbnail` with `project_id` set).
  - Call `updateThumbnailProject`, then invalidate/refetch only the list queries that were optimistically updated (e.g. current view + source project + target project), or keep existing invalidate-all and treat optimistic update as a quick visual fix until refetch completes.
  - Optionally: disable the project dropdown or show a loading state on the moved card until the move request completes.

**Pros & Cons:**

- ✅ UI updates immediately; less dependence on refetch timing.
- ✅ Can narrow invalidation to affected project lists if desired.
- ⚖️ More code (cache updates, handling rollback on API failure).
- ⚖️ Risk of cache/DB mismatch if rollback or error handling is wrong.

**Complexity:** Medium

**Strategic fit:** Choose this if “move” is a frequent action and you want it to feel instant after the minimal fix is in place.

---

### Path 3: The Realtime / Mutation-Centric Path

**Concept:** Treat “move to project” as a first-class mutation that drives both the API and the client cache, with optional Supabase realtime for multi-tab consistency.

**High-level architecture:**

- **Backend:** List fix (Path 1) remains. Optionally: Supabase realtime on `thumbnails` for `project_id` changes so other tabs/sessions see moves without refetch.
- **Frontend:**
  - Introduce a dedicated mutation (e.g. `useMoveThumbnailToProject`) that:
    - Calls POST `/api/thumbnails/[id]/project`.
    - On success: updates all relevant list caches (remove from old list, add to new list with correct `project_id`) and optionally updates any `thumbnails.detail(id)` cache.
  - Optionally subscribe to Supabase `thumbnails` changes and invalidate or patch list/detail queries when `project_id` changes for the current user’s thumbnails.

**Pros & Cons:**

- ✅ Clear ownership of “move” logic; cache stays in sync with server.
- ✅ Realtime can keep multiple tabs/devices consistent.
- ⚖️ Realtime adds backend/config and subscription handling.
- ⚖️ More moving parts than Path 1 or 2.

**Complexity:** Medium–High

**Strategic fit:** Consider if you need cross-tab consistency or are already investing in Supabase realtime elsewhere.

---

## Recommended Starting Point

**Path 1 (Minimal Fix)** is implemented and is the right first step:

1. The bug was the missing `project_id` in the list response; fixing that fixes the observable behavior.
2. No frontend or API contract changes are required beyond the one select list.
3. You can add Path 2 (optimistic UI) or Path 3 (mutation + realtime) later if you want faster feedback or multi-tab consistency.

**Verification:** After the fix, move a thumbnail to another project and confirm (1) the card’s project dropdown shows “(current)” for the new project when viewing that project, and (2) the thumbnail disappears from the previous project’s list and appears in the new project’s list after refetch.
