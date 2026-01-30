# Architecture & Code Health Audit Report

**Version:** 2025-01-29 (architecture & code health audit; update this timestamp when regenerating.)

This audit used `docs/system_understanding.md` (and checked for `docs/understand_system.md`, which does not exist) to understand the current system architecture. The codebase was scanned for technical debt, duplicated patterns, inconsistent data access, and reactive anti-patterns.

---

## Overview

The ViewBait codebase follows a clear **API-route–centric** architecture: UI calls services that `fetch('/api/...')`, and API routes use a server Supabase client with `requireAuth` and server-side data layers. **No server actions** are used; data access is split between API routes (primary) and a few justified client Supabase usages (auth, public storage). Strengths include centralized auth utilities (`requireAuth`/`getOptionalAuth`), error sanitization, URL refresh utilities, and React Query for client caching. The main issues are **repeated boilerplate** in API routes (try/catch + requireAuth + NextResponse check), **duplicated logic** (signed URL refresh in thumbnails [id], public list + favorite counts in styles/palettes), **inconsistent use** of shared helpers (e.g. `parseQueryParams` exists but most routes parse query params by hand), and **direct `fetch` in studio components** instead of going through services. Addressing these will reduce footprint, centralize behavior, and lower the risk of bugs and security drift without changing features.

---

## 1. Current State

### 1.1 Data flow and boundaries

- **UI → API:** Most UI uses hooks (e.g. `useThumbnails`, `useStyles`, `useSubscription`) that call services (e.g. `lib/services/thumbnails.ts`), which call `fetch('/api/...')`. ✅
- **API routes:** 70+ route handlers each call `createClient()` from `lib/supabase/server.ts`, then `requireAuth(supabase)` (or `getOptionalAuth`), then business logic, then return JSON or error responses. ✅
- **Server data layer:** `lib/server/data/*.ts` provides query builders (e.g. `buildThumbnailsQuery`, `buildStylesQuery`, `buildPalettesQuery`) and is used by many but not all routes. ✅
- **Client Supabase:** Used only for auth (`lib/services/auth.ts`) and for public bucket uploads in `lib/services/storage.ts`; private buckets go through API. ✅
- **Service role:** Used in auth callback (YouTube tokens), credits RPC, broadcast notifications, Stripe webhooks, and server-only services (YouTube, Stripe, referrals server functions). ✅

### 1.2 Shared utilities (existing)

| Utility | Location | Usage |
|--------|----------|--------|
| Auth | `lib/server/utils/auth.ts` | `requireAuth`, `getOptionalAuth` — used in all protected API routes ✅ |
| Error responses | `lib/server/utils/error-handler.ts` | Standardized 401/403/404/500 responses; used widely ✅ |
| Error sanitization | `lib/utils/error-sanitizer.ts` | Used by error-handler to avoid leaking prompts/PII ✅ |
| URL refresh | `lib/server/utils/url-refresh.ts` | `refreshThumbnailUrls`, `refreshFaceUrls`, `refreshStyleUrls`, `refreshSingleUrl` ✅ |
| Query builder | `lib/server/utils/query-builder.ts` | `QueryPatterns.userOwned`, `userOwnedWithFavorites`, `applyCursorPagination` ✅ |
| Cache headers | `lib/server/utils/cache-headers.ts` | `createCachedResponse`, strategy-based headers ✅ |
| API helpers | `lib/server/utils/api-helpers.ts` | `parseQueryParams`, `buildPaginatedResponse` — **underused** ⚠️ |

### 1.3 Where duplication and inconsistency appear

- **API route boilerplate:** Every protected route repeats: `try { const supabase = await createClient(); const user = await requireAuth(supabase); ... } catch (error) { if (error instanceof NextResponse) return error; return serverErrorResponse(...) }`. No shared wrapper. ⚠️
- **Query param parsing:** Routes like `thumbnails/route.ts`, `notifications/route.ts`, `favorites/route.ts` manually parse `searchParams.get('limit')`, `parseInt(..., 10)`, etc. `parseQueryParams` in `api-helpers.ts` exists but is not used by these routes. ⚠️
- **Signed URL refresh for single thumbnail:** `app/api/thumbnails/[id]/route.ts` implements its own path extraction, `createSignedUrl`, and fallback extensions instead of using `refreshSingleUrl` (or a thin wrapper) from `lib/server/utils/url-refresh.ts`. 🚫
- **Public list + favorite counts:** `app/api/styles/route.ts` and `app/api/palettes/route.ts` both implement the same pattern for `publicOnly`: fetch from `public_styles`/`public_palettes`, then use service client to fetch favorites by `item_id`/`item_type`, then merge counts. Logic is duplicated. 🚫
- **Cron/storage path extraction:** `app/api/cron/cleanup-free-tier-thumbnails/route.ts` defines its own `extractStoragePath` and delete-with-fallback logic; similar concepts exist in `url-refresh.ts` (`extractStoragePath`). ⚠️
- **Direct fetch in components:** `studio-chat.tsx`, `studio-provider.tsx`, `studio-views.tsx`, `studio-generator.tsx` call `fetch('/api/assistant/chat', ...)`, `fetch('/api/storage/upload', ...)`, `fetch('/api/profiles')` directly instead of going through `lib/services/*`. ⚠️

### 1.4 State management and reactive patterns

- **React Query:** Used for thumbnails, styles, palettes, subscription, referrals, notifications with `enabled: !!user` (or similar). No evidence of effects that refetch on every render; `staleTime` and `refetchOnWindowFocus` are set. ✅
- **useSubscription:** Uses `refetchInterval: 60_000` with `refetchIntervalInBackground: false`; no cascading refetch observed. ✅
- **Generator state:** `useGeneratorState` uses a reducer and localStorage for settings; no problematic effects identified. ✅

### 1.5 Separation of concerns

- **Data security:** Auth and user scoping are enforced in API routes via `requireAuth` and server client; UI does not perform auth decisions. ✅
- **Data access:** Most reads/writes go through API routes; exceptions are auth (client Supabase) and public storage upload (client Supabase), which are intentional. ✅
- **Side effects:** Mutations (create, update, delete) are triggered from UI but implemented in API routes; React Query invalidations are used after mutations. ✅

---

## 2. Problems

### 2.1 🚫 Duplicated signed URL refresh in GET /api/thumbnails/[id]

**Problem:** Single-thumbnail fetch implements its own signed URL refresh (path extraction, `createSignedUrl`, fallback extensions) instead of reusing `lib/server/utils/url-refresh.ts`.

**Location:** `viewbait/app/api/thumbnails/[id]/route.ts` (GET handler, roughly lines 43–69).

**Impact:** Bug risk when URL refresh logic changes (e.g. expiry or bucket naming); larger route file and two sources of truth for “how we refresh a thumbnail URL.”

---

### 2.2 🚫 Duplicated “public list + favorite counts” in styles and palettes

**Problem:** Both `GET /api/styles` and `GET /api/palettes` implement the same flow for `publicOnly`: query public view → get IDs → query favorites with service client by `item_id`/`item_type` → merge counts into items. Logic is copy-pasted with only table/view names differing.

**Locations:** `viewbait/app/api/styles/route.ts`, `viewbait/app/api/palettes/route.ts`.

**Impact:** Changes to “how we attach favorite counts to public items” must be done in two places; easy to forget one or diverge behavior.

---

### 2.3 ⚠️ No shared “withAuth” wrapper for API route handlers

**Problem:** Every protected API route repeats the same pattern: create server client, call `requireAuth(supabase)`, run logic, and in catch check `if (error instanceof NextResponse) return error` then `serverErrorResponse(...)`. This is repeated in 70+ files.

**Impact:** Boilerplate in every route; any change to “how we run an authenticated handler” (e.g. logging, metrics, or error handling) would require touching many files.

---

### 2.4 ⚠️ parseQueryParams and buildPaginatedResponse underused

**Problem:** `lib/server/utils/api-helpers.ts` exposes `parseQueryParams` and `buildPaginatedResponse`, but most list routes parse query params manually (e.g. `thumbnails/route.ts`, `notifications/route.ts`, `favorites/route.ts`, `thumbnails/public/route.ts`, `thumbnails/search/route.ts`).

**Impact:** Inconsistent parsing (e.g. max limit, default limit, cursor handling); more code and more room for small bugs or drift.

---

### 2.5 ⚠️ Studio components call fetch() directly instead of services

**Problem:** The following components call `fetch('/api/...')` directly instead of using existing (or new) service functions:

- `viewbait/components/studio/studio-chat.tsx` — `/api/assistant/chat`
- `viewbait/components/studio/studio-provider.tsx` — `/api/assistant/chat`
- `viewbait/components/studio/studio-views.tsx` — `/api/storage/upload` (twice)
- `viewbait/components/studio/studio-generator.tsx` — `/api/profiles`, `/api/storage/upload` (twice)

**Impact:** Harder to mock in tests; inconsistent error handling and URL/body construction; any change to API contract or auth headers must be updated in multiple components.

---

### 2.6 ⚠️ Initial auth state not provided from server

**Problem:** `AuthProvider` accepts `initialUser`, `initialSession`, `initialProfile`, and `getInitialAuthState()` exists in `lib/server/data/auth.ts`, but no layout (e.g. root layout) passes this state. Auth therefore initializes only on the client after hydration.

**Impact:** Possible flash of “logged out” or loading state before auth resolves; slightly worse perceived performance and layout shift.

---

### 2.7 ⚠️ Cron cleanup defines its own storage path extraction

**Problem:** `app/api/cron/cleanup-free-tier-thumbnails/route.ts` defines `extractStoragePath` and delete-with-extension-fallback locally. `lib/server/utils/url-refresh.ts` already has `extractStoragePath(url, bucket)` for signed URLs.

**Impact:** Two implementations of “get storage path from URL/context”; cron could diverge from main URL/storage conventions.

---

## 3. Target Architecture

### 3.1 Principles

1. **Single place for “run authenticated handler”:** Introduce a small wrapper (e.g. `withAuth(handler)` or `handleWithAuth(handler)`) that creates the server client, calls `requireAuth`, runs the handler with `{ supabase, user }`, and catches `NextResponse` and generic errors. Routes that need optional auth can use a variant (e.g. `withOptionalAuth`).
2. **Single place for “refresh one thumbnail URL”:** All “get one thumbnail with fresh URL” flows (including GET `/api/thumbnails/[id]`) should use `refreshSingleUrl` (or a tiny wrapper) from `url-refresh.ts`. No second implementation of path extraction + signed URL + fallback in route code.
3. **Single place for “public list with favorite counts”:** Extract a shared helper (e.g. in server data layer or a small util) that, given a list of public items with IDs and an `item_type`, fetches favorite counts from the service client and returns items with a `like_count` (or equivalent). Styles and palettes routes call this with their respective view and `item_type`.
4. **Consistent query param parsing:** List/paginated routes use `parseQueryParams` (and where applicable `buildPaginatedResponse`) from `api-helpers.ts`, with route-specific options (allowedOrderBy, defaultLimit, maxLimit). No ad hoc `searchParams.get` + `parseInt` for limit/offset/cursor/order in each route.
5. **All API calls from UI go through services:** Studio (and any other) components do not call `fetch('/api/...')` directly. They call service functions (e.g. `assistantChat`, `uploadFile` from storage service, `getProfile` from profiles service). Services remain the single place for URL, method, body, and error handling.
6. **Optional: Server-rendered initial auth:** Root layout (or a parent of `Providers`) calls `getInitialAuthState()` and passes the result into `AuthProvider` so the first paint can show authenticated state when a session exists.

### 3.2 Simplified flow (after refactors)

- **New route:** Implement handler that receives `{ supabase, user }` (or `user | null` for optional auth); use `parseQueryParams` where applicable; use server data layer + URL refresh helpers; return JSON or use error-handler helpers. No repeated try/catch/requireAuth in each file.
- **Single thumbnail:** GET `/api/thumbnails/[id]` uses shared URL refresh helper; no local path-extract/signed-URL/fallback block.
- **Public styles/palettes:** Both use one “public list + favorite counts” helper; routes only pass view name and item type.
- **Studio:** All API calls go through `lib/services/*`; components stay presentational/coordinating.

---

## 4. Effect If Fixed vs Not Fixed

| Area | If fixed | If not fixed |
|------|----------|--------------|
| **Signed URL for single thumbnail** | One implementation to maintain; consistent expiry and fallback behavior; smaller route file. | Two implementations; future changes to refresh logic risk bugs or inconsistency in one path. |
| **Public list + favorite counts** | One helper; styles and palettes stay in sync; easier to add same pattern elsewhere (e.g. public thumbnails). | Edits and bug fixes must be done in two places; behavior can diverge. |
| **withAuth wrapper** | Less boilerplate; one place to add logging, metrics, or error handling for authenticated routes. | Every new route copies the same block; refactors require touching many files. |
| **parseQueryParams / buildPaginatedResponse** | Consistent limits, cursors, and response shape; fewer parsing bugs. | Drift in defaults and validation across routes; more code. |
| **Studio → services** | Easier testing (mock services); consistent error handling and API contract. | Harder to test and refactor; API changes require hunting through components. |
| **Initial auth state** | Fewer flashes of “logged out” and layout shift. | Same UX; no functional bug. |
| **Cron path extraction** | Reuse or align with url-refresh/storage conventions; one place for “path from URL.” | Cron can diverge from rest of app; minor maintenance burden. |

---

## 5. Actionable Prompts for an AI Agent

Each prompt below is self-contained so an AI coding agent can implement the change. They assume the repo layout under `viewbait/` and that `docs/system_understanding.md` (and this audit) describe the current architecture.

---

### 5.1 Fix: Use shared URL refresh in GET /api/thumbnails/[id]

**The Problem:** The GET handler for a single thumbnail implements its own signed URL refresh (path extraction, createSignedUrl, fallback extensions), duplicating logic in `lib/server/utils/url-refresh.ts` and risking inconsistency.

**The Current State:** In `viewbait/app/api/thumbnails/[id]/route.ts`, the GET handler after fetching the thumbnail row manually extracts storage path from `thumbnail.image_url`, calls `supabase.storage.from('thumbnails').createSignedUrl(...)`, and has a fallback for `.jpg`. The shared utility `refreshSingleUrl(supabase, bucket, url, fallbackPath)` in `lib/server/utils/url-refresh.ts` already does this with a single API.

**The Goal State:** The GET handler fetches the thumbnail row (with ownership check), then calls `refreshSingleUrl(supabase, 'thumbnails', thumbnail.image_url, `${user.id}/${thumbnail.id}/thumbnail.png`)` (or equivalent) to get the refreshed URL, and returns the thumbnail with that URL. No local path extraction or createSignedUrl/fallback logic in the route.

**Unit Test (or validation):**  
- In a test or manual check: for a thumbnail that has `image_url` set (signed or not), GET `/api/thumbnails/[id]` returns 200 and the response body includes an `image_url` that is a valid signed URL for the thumbnails bucket.  
- If the thumbnail does not exist or does not belong to the user, GET returns 404.

**Implementation Prompt:**

```
Refactor GET /api/thumbnails/[id] so it does not implement its own signed URL refresh. After loading the thumbnail row (with .eq('user_id', user.id)), use the existing function refreshSingleUrl from viewbait/lib/server/utils/url-refresh.ts with bucket 'thumbnails', the thumbnail's image_url, and fallback path `${user.id}/${thumbnail.id}/thumbnail.png`. Return the thumbnail object with the refreshed image_url. Remove all local logic that extracts storage path, calls createSignedUrl, or tries alternate extensions. Keep the same response shape and status codes (200, 404). Ensure requireAuth and error handling (including catch for NextResponse) are unchanged.
```

---

### 5.2 Fix: Extract shared “public list with favorite counts” for styles and palettes

**The Problem:** GET /api/styles and GET /api/palettes duplicate the same pattern for `publicOnly`: fetch public view, get item IDs, query favorites by item_type/item_id with service client, merge counts into items.

**The Current State:** In `viewbait/app/api/styles/route.ts` and `viewbait/app/api/palettes/route.ts`, when `publicOnly` is true, each route: (1) queries `public_styles` or `public_palettes`, (2) gets IDs, (3) uses createServiceClient() to query favorites with .eq('item_type', 'style'|'palette').in('item_id', ids), (4) builds a count map and merges into items. The logic is almost identical except for table/view and item_type.

**The Goal State:** A single helper (e.g. in `lib/server/data/` or `lib/server/utils/`) that accepts: the list of public items (with an `id` field), the `item_type` string ('style' or 'palette'), and returns the same list with each item enriched by a `like_count` (or existing field name). Both styles and palettes GET handlers use this helper when `publicOnly` is true; they do not contain their own favorite-fetch and merge logic.

**Unit Test:**  
- Given a list of items with ids and an item_type, the helper returns the same list with each item having a numeric like_count (0 if no favorites).  
- Mock the service client so that a known set of item_ids have known counts; assert the returned items have the correct like_count.

**Implementation Prompt:**

```
Add a shared server-side helper that attaches favorite counts to a list of public items. The helper should accept: (1) an array of items that have an 'id' field, (2) item_type 'style' or 'palette'. It should use createServiceClient from viewbait/lib/supabase/service.ts to query the favorites table for .eq('item_type', item_type) and .in('item_id', ids), build a map of item_id -> count, and return the items with each item having a like_count (or the existing field name used in the API) set. Place this helper in viewbait/lib/server/data/ (e.g. favorites.ts or a new file) or in viewbait/lib/server/utils/ so it can be used by both styles and palettes routes. Then refactor GET /api/styles and GET /api/palettes: when publicOnly is true, after fetching from public_styles or public_palettes, call this helper instead of duplicating the favorites query and merge. Do not change the response shape or caching behavior of the routes.
```

---

### 5.3 Fix: Introduce withAuth (or equivalent) wrapper for API route handlers

**The Problem:** Every protected API route repeats the same boilerplate: create server client, requireAuth(supabase), run logic, and in catch check for NextResponse and call serverErrorResponse. This is error-prone and makes it hard to evolve auth or error handling in one place.

**The Current State:** Handlers are plain async functions that do `const supabase = await createClient(); const user = await requireAuth(supabase); ...` and in catch `if (error instanceof NextResponse) return error; return serverErrorResponse(...)`.

**The Goal State:** A wrapper function (e.g. `withAuth`) that: (1) creates the server client, (2) calls requireAuth(supabase), (3) invokes the actual handler with `{ request, params?, supabase, user }`, (4) catches errors and if it's NextResponse returns it, otherwise returns serverErrorResponse with a configurable message/context. Protected route handlers become thin: they export GET/POST/etc. that call `withAuth(innerHandler)`. Optional-auth routes can use a similar `withOptionalAuth` that passes `user | null`.

**Unit Test:**  
- A route that uses withAuth returns 401 when no session.  
- When authenticated, the inner handler receives supabase and user and its return value is returned.  
- When the inner handler throws NextResponse.json(...), that response is returned; when it throws a generic Error, a 500 with sanitized message is returned.

**Implementation Prompt:**

```
Introduce a withAuth wrapper in viewbait/lib/server/utils/ (e.g. in auth.ts or a new file like route-wrapper.ts). withAuth should: (1) await createClient() from viewbait/lib/supabase/server, (2) await requireAuth(supabase), (3) call the provided handler with an object { request, params, supabase, user } (params optional for non-dynamic routes), (4) in a try/catch, if the caught value is an instance of NextResponse return it, otherwise return serverErrorResponse with a configurable default message and route context. Type the handler so it returns Response | NextResponse | Promise<Response | NextResponse>. Then refactor one or two existing protected API routes (e.g. viewbait/app/api/thumbnails/route.ts GET) to use withAuth so the pattern is clear; leave the rest of the routes to be migrated in a follow-up. Document in code that new protected routes should use withAuth.
```

---

### 5.4 Fix: Use parseQueryParams (and buildPaginatedResponse where applicable) in list routes

**The Problem:** Many list API routes manually parse limit, offset, cursor, orderBy, orderDirection from searchParams instead of using the existing parseQueryParams and buildPaginatedResponse in viewbait/lib/server/utils/api-helpers.ts, leading to inconsistency and duplication.

**The Current State:** Routes such as thumbnails/route.ts, notifications/route.ts, favorites/route.ts, thumbnails/public/route.ts, thumbnails/search/route.ts use searchParams.get('limit'), parseInt(..., 10), etc. directly. api-helpers exports parseQueryParams and buildPaginatedResponse but they are not used by these routes.

**The Goal State:** List routes that support limit/offset/cursor/orderBy/orderDirection use parseQueryParams(request, { defaultLimit, maxLimit, allowedOrderBy, ... }) and, where applicable, buildPaginatedResponse for the response. Route-specific params (e.g. favoritesOnly, q for search) continue to be read from searchParams; only the common pagination/sort params go through the helper.

**Unit Test:**  
- For a route that uses parseQueryParams: request with limit=5 returns at most 5 items; limit=9999 is clamped to maxLimit if configured; invalid limit falls back to default.  
- buildPaginatedResponse: when useCursor is true and data has length limit+1, response has hasNextPage true and nextCursor set from the last item; data in response has length limit.

**Implementation Prompt:**

```
Refactor the GET handler of viewbait/app/api/thumbnails/route.ts to use parseQueryParams from viewbait/lib/server/utils/api-helpers.ts for limit, cursor, orderBy, and orderDirection. Use the options that match current behavior (e.g. defaultLimit 24, allowedOrderBy ['created_at', 'title']). Keep favoritesOnly and any other route-specific params parsed from searchParams. If the response shape matches, use buildPaginatedResponse for the JSON body; otherwise keep the current shape but ensure it is built from the result of parseQueryParams. Then apply the same pattern to viewbait/app/api/notifications/route.ts (limit, offset, unreadOnly, archivedOnly — only limit/offset via parseQueryParams if the helper supports offset). Do not change the external API contract or cache headers.
```

---

### 5.5 Fix: Route studio API calls through services

**The Problem:** Studio components call fetch('/api/...') directly instead of using service layer functions, which makes testing harder and spreads API contract and error handling across components.

**The Current State:** studio-chat.tsx and studio-provider.tsx call fetch('/api/assistant/chat', ...); studio-views.tsx calls fetch('/api/storage/upload', ...) twice; studio-generator.tsx calls fetch('/api/profiles') and fetch('/api/storage/upload', ...) twice. Services exist for storage (uploadFile, etc.) and profiles (getProfile); assistant chat may not have a dedicated service function yet.

**The Goal State:** All these calls go through functions in viewbait/lib/services/: storage uploads via existing or extended storage service; profile fetch via existing profiles service; assistant chat via a new or existing assistant/chat service function that takes the same payload and returns the same shape. Components call only service functions; no raw fetch to /api/ in these components.

**Unit Test (or UI test):**  
- Unit: Service function for assistant chat (if added) accepts conversationHistory and formState and returns the same structure as the API.  
- Unit: Storage upload is called with bucket, path, and file; component does not contain the string '/api/storage/upload'.  
- UI (optional): In studio, opening chat and sending a message still triggers a request to /api/assistant/chat and shows a response; upload flow still uploads to storage and updates UI.

**Implementation Prompt:**

```
Refactor viewbait/components/studio so they do not call fetch('/api/...') directly. (1) For storage uploads: use the existing uploadFile (or equivalent) from viewbait/lib/services/storage.ts; replace the two fetch('/api/storage/upload', ...) calls in studio-views.tsx and the two in studio-generator.tsx with calls to that service, passing the same bucket, path, and file. (2) For profile: replace fetch('/api/profiles') in studio-generator.tsx with getProfile from viewbait/lib/services/profiles.ts. (3) For assistant chat: add a function in viewbait/lib/services/ (e.g. assistant.ts or extend an existing service) that accepts the same request body as POST /api/assistant/chat and calls fetch('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(...) }), then returns the parsed JSON or throws on non-ok. Replace the direct fetch calls in studio-chat.tsx and studio-provider.tsx with this service function. Preserve existing error handling and loading behavior in the components. Do not change the API routes themselves.
```

---

### 5.6 Fix: Optional — Pass initial auth state from server to AuthProvider

**The Problem:** AuthProvider supports initialUser/initialSession/initialProfile and getInitialAuthState() exists, but no layout provides this, so auth only resolves after client-side hydration and can cause a brief “logged out” or loading state.

**The Current State:** Root layout in viewbait/app/layout.tsx renders Providers with no initial auth props. getInitialAuthState in viewbait/lib/server/data/auth.ts is not called from any layout.

**The Goal State:** The root layout (or a server component parent of Providers) calls getInitialAuthState() and passes the result as initialUser, initialSession, initialProfile to AuthProvider. AuthProvider is updated if needed so it accepts and uses these props on first render.

**Unit Test:**  
- With a valid session cookie, the first HTML response includes or leads to a first paint where the user is shown as logged in (or a test that getInitialAuthState returns non-null when the server has a session).  
- When there is no session, initial state is null and the app still shows logged-out state.

**Implementation Prompt:**

```
In viewbait/app/layout.tsx, make the root layout an async server component that calls getInitialAuthState from viewbait/lib/server/data/auth.ts. Pass the returned user, session, and profile to the Providers component as initialUser, initialSession, initialProfile. Update viewbait/app/providers.tsx so that AuthProvider receives these props and passes them through to the AuthProvider from viewbait/lib/hooks/useAuth.tsx. Ensure AuthProvider uses these initial values for the first render so that when a session exists, the client does not briefly show unauthenticated state. Handle the case where getInitialAuthState throws (e.g. pass null) so the app still renders.
```

---

### 5.7 Fix: Reuse or align cron storage path extraction with url-refresh

**The Problem:** The cron job cleanup-free-tier-thumbnails defines its own extractStoragePath and delete-with-fallback logic, while url-refresh already has extractStoragePath. This creates two places that encode “how we get a storage path from a URL.”

**The Current State:** viewbait/app/api/cron/cleanup-free-tier-thumbnails/route.ts has a local extractStoragePath(imageUrl, userId, thumbnailId) and deleteThumbnailFromStorage that tries extensions. viewbait/lib/server/utils/url-refresh.ts has extractStoragePath(url, bucket).

**The Goal State:** Cron either imports and uses extractStoragePath from url-refresh where the URL format matches (and only differs by bucket/path convention), or a small shared helper in server utils is used by both url-refresh and cron for “path from thumbnail URL/context.” Delete-with-fallback in cron can stay in the cron file but should use the same path convention as the rest of the app.

**Unit Test:**  
- For a signed URL in the form used by the app, the shared extractStoragePath returns the expected path segment.  
- Cron job still successfully deletes thumbnails (manual or integration test).

**Implementation Prompt:**

```
Refactor viewbait/app/api/cron/cleanup-free-tier-thumbnails/route.ts to use extractStoragePath from viewbait/lib/server/utils/url-refresh.ts where possible. The cron currently has extractStoragePath(imageUrl, userId, thumbnailId); if the signed URL pattern matches what url-refresh expects, call extractStoragePath(imageUrl, 'thumbnails') and use the result; if the URL is missing or malformed, fall back to constructing the path as userId/thumbnailId/thumbnail.png (or the same fallback the cron uses today). Update deleteThumbnailFromStorage to use this single path source so we do not have two different implementations of “get storage path from thumbnail context.” Ensure the cron still passes any existing tests or manual checks.
```

---

*End of audit report.*
