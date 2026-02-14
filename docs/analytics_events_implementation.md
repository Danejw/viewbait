# Analytics Events Implementation

This document describes how the custom user analytics feature was implemented: what was added, what changed, and how each part works.

---

## Overview: Tracked Events

| Event name | What it's for | What it means |
|------------|----------------|---------------|
| **page_view** | Traffic and navigation | User viewed a page (client-side route change). Fired on every pathname change. Used for top pages and session journeys. |
| **generate_started** | Generation funnel | User submitted a thumbnail generation (manual generator). Fired when they click Generate. Properties: `source` (e.g. "manual"), `batch_size` (variations count). |
| **generate_completed** | Generation funnel | At least one thumbnail was created successfully for that submission. Properties: `count` (successful images), `source`. |
| **generate_failed** | Generation funnel / errors | Generation request failed (all failed or partial). Properties: `reason` ("api" or "partial"). Used for drop-off and error insight. |
| **thumbnail_download** | Feature usage | User downloaded a thumbnail image to their device (from gallery/results). |
| **thumbnail_edit_started** | Feature usage | User opened the edit/regenerate modal for a thumbnail. |
| **thumbnail_edit_completed** | Feature usage | Edit/regenerate API succeeded and a new thumbnail was created. |
| **thumbnail_favorited** | Feature usage | User toggled favorite on a thumbnail. |
| **checkout_started** | Checkout funnel | User clicked to go to Stripe Checkout (e.g. selected a paid tier in the subscription modal). Properties: `product` (tier name). |
| **checkout_completed** | Checkout funnel | User returned from Stripe and process-checkout succeeded; subscription is synced. Used for conversion and drop-off. |
| **assistant_message_sent** | Assistant usage | User sent a message in the in-sidebar chat or the standalone Assistant panel. |
| **assistant_response_received** | Assistant usage | The assistant returned a response (non-stream or stream complete). Used with messages sent for engagement. |
| **youtube_connect_started** | YouTube integration | User clicked to connect their YouTube account (OAuth flow started). |
| **youtube_connect_completed** | YouTube integration | User completed YouTube OAuth and integration was saved successfully. |
| **youtube_connect_failed** | YouTube integration | YouTube OAuth failed or was denied. Properties: `error` (short code or message). |
| **error** | Reliability and debugging | A client-side error was caught (error boundary or critical path). Properties: `context` (e.g. "generation", "checkout", "assistant", "error_boundary"), `message` (sanitized, short). |
| **sign_in** | Auth and growth | User signed in successfully (email/password or Google). |
| **sign_up** | Auth and growth | User completed sign-up and account was created successfully. |

---

## 1. What This Feature Is For

- **Purpose:** Track user behavior (page views, button clicks, feature usage, errors) in our app, store events in our database, and let admins view aggregated analytics (popular events, active users, journeys, errors) in a dedicated **Analytics** tab under Admin.
- **Access:** Only users with the **admin role** can view event-level data. The track endpoint is public (anonymous and authenticated users can send events); the server never trusts a client-supplied `user_id` and sets it from auth.

---

## 2. What Changed (Summary)

| Area | What was added or changed |
|------|----------------------------|
| **Database** | New table `analytics_events` (migration `017_analytics_events.sql`) with RLS enabled and no app-role policies; only the API (service role) writes and reads. |
| **Types** | New file `types/analytics.ts`: event payloads, batch body, admin API response shapes, export item shape. |
| **Rate limit** | New entry `track` in `lib/server/utils/rate-limit.ts` (120 requests per minute per identity). |
| **API** | New `POST /api/track` (accepts single event or batch; validates, sanitizes, rate-limits; inserts via service client). New `GET /api/admin/analytics/events` (admin-only; overview and optional `view=journeys`). |
| **Frontend tracking** | New `lib/analytics/session.ts` (session ID in `localStorage` key `vb_sid`), `lib/analytics/track.ts` (queue + flush to `/api/track`), and `components/analytics-tracker.tsx` (syncs user, tracks `page_view` on pathname change). |
| **App shell** | `AnalyticsTracker` rendered inside `AuthProvider` in `app/providers.tsx`. |
| **Admin UI** | New **Analytics** tab content in `components/admin/admin-view-content.tsx` (tab value `analytics`) and new component `components/admin/admin-analytics-dashboard.tsx`. Service `lib/services/admin-event-analytics.ts` and hook `hooks/use-admin-event-analytics.ts` for fetching. |
| **Account export** | `app/api/account/export/route.ts` now fetches the current user’s `analytics_events` via service client and adds `analytics_events` to the export JSON (GDPR data portability). |
| **Docs** | `docs/analytics.md` (retention, GDPR, rate limit, cron location). Tests: `lib/analytics/session.test.ts`, and `track` rate-limit test in `lib/server/utils/rate-limit.test.ts`. |

---

## 3. How It Works

### 3.1 Database

- **Table:** `analytics_events`
  - `id` (uuid, PK)
  - `event_name` (text, required)
  - `user_id` (uuid, nullable, FK to `auth.users(id) ON DELETE CASCADE`) — `NULL` for anonymous
  - `session_id` (text, required) — client-generated, stored in `localStorage`
  - `page_path` (text, nullable)
  - `properties` (jsonb, default `{}`)
  - `created_at` (timestamptz, default `now()`)
- **Indexes:** `user_id`, `created_at`, `(event_name, created_at)`, `(session_id, created_at)` for admin queries and retention.
- **RLS:** Enabled. No policies are defined for `authenticated` or `anon`. The app never reads or writes this table with the anon or authenticated Supabase client; the **service role** client is used in API routes only, so it bypasses RLS. Effect: only server-side code can insert or read.

### 3.2 Session ID (Frontend)

- **File:** `lib/analytics/session.ts`
- **Storage key:** `vb_sid` in `localStorage`.
- **Behavior:** `getOrCreateSessionId()` returns an existing value if present and long enough (≥10 chars); otherwise generates a new ID (`crypto.randomUUID()` or fallback), saves it, and returns it. Used so all events from the same browser session share one `session_id`.

### 3.3 Client-Side Tracking

- **Files:** `lib/analytics/track.ts`, `components/analytics-tracker.tsx`
- **Public API:**
  - `track(eventName, properties?)` — enqueues an event; when queue reaches 10 or after 5 seconds, flushes to `POST /api/track` with body `{ events: [...] }`. Non-blocking (uses `requestIdleCallback` or `setTimeout(0)` and `fetch(..., { keepalive: true })`).
  - `trackImmediate(eventName, properties?)` — sends one event immediately (still fire-and-forget).
  - `setTrackUserId(id)` — sets the current user id for the tracker (used by `AnalyticsTracker` from auth; **note:** the server overwrites `user_id` from auth, so the client does not send `user_id` in the payload).
- **Queue:** In-memory queue, max 10 events; flush on size or after 5 s. Each flush sends a batch to `/api/track`.
- **AnalyticsTracker:** Renders nothing. Inside `AuthProvider` it (1) calls `setTrackUserId(user?.id ?? null)` when user changes, and (2) calls `track('page_view', { path: pathname })` when `pathname` (from `usePathname()`) changes.
- **Other events** (tracked across the app):
  - **Generation:** `generate_started` (source: manual|chat, batch_size), `generate_completed` (count, source), `generate_failed` (reason).
  - **Thumbnails:** `thumbnail_download`, `thumbnail_edit_started`, `thumbnail_edit_completed`, `thumbnail_favorited`.
  - **Checkout:** `checkout_started` (product), `checkout_completed`.
  - **Assistant:** `assistant_message_sent`, `assistant_response_received`.
  - **YouTube:** `youtube_connect_started`, `youtube_connect_completed`, `youtube_connect_failed` (error code).
  - **Errors:** `error` (context, message) from error boundaries and critical failure paths.
  - **Auth:** `sign_in`, `sign_up`.

### 3.4 POST /api/track

- **File:** `app/api/track/route.ts`
- **Auth:** `getOptionalAuth(supabase)` — both anonymous and authenticated requests allowed.
- **Rate limit:** `enforceRateLimit('track', request, user?.id ?? null)` — 120 requests per minute per user or per IP (for anonymous). Returns 429 when exceeded.
- **Body:**
  - Single event: `{ event_name, session_id?, page_path?, properties? }`
  - Batch: `{ events: [ { event_name, session_id?, page_path?, properties? }, ... ] }` (max 20 events per request; extra are dropped).
- **Validation:**
  - `event_name`: required, string, trimmed, max length 128; must not start with `admin_` or `internal_` (blocklist).
  - `session_id`: required, non-empty string, trimmed, max 256 chars.
  - `page_path`: optional, max 2048 chars.
  - `properties`: optional object; sanitized (see below).
- **Sanitization of `properties`:**
  - Keys in `SENSITIVE_KEYS` (e.g. `password`, `token`, `credit_card`, `api_key`, `secret`, `authorization`) are stripped.
  - Max 10 keys; each value JSON-serializable and ≤ 1KB; total `properties` ≤ 2KB.
- **Write:** `user_id` is set from `user?.id ?? null` (never from client). Rows are inserted with `createServiceClient().from('analytics_events').insert(rows)`. Response: 204 on success; 400 on validation failure; 429 when rate limited; 500 on server error.

### 3.5 GET /api/admin/analytics/events (Admin Only)

- **File:** `app/api/admin/analytics/events/route.ts`
- **Auth:** `requireAdmin(supabase)` — only admin role; returns 403 for non-admin.
- **Reads:** All via `createServiceClient()` (bypasses RLS).
- **Query params:**
  - `range`: `7d` or `30d` (default 30) — time window for data.
  - `view`: if `journeys`, returns session journeys instead of overview.
  - For journeys: `sessions_limit` (default 100, max 200), `events_per_session` (default 50, max 100).
- **Overview response** (no `view` or `view` ≠ `journeys`):
  - `popularEvents`: top 20 event names by count in range.
  - `activeUsers`: distinct identities (user_id or session_id for anonymous) for daily, weekly, and monthly windows.
  - `errors`: count of events with `event_name = 'error'` and up to 20 recent such events with `id`, `created_at`, `properties`.
  - `featureAdoption`: counts for `generate_started` and `generate_completed` and derived drop-off rate.
- **Journeys response** (`view=journeys`):
  - `sessions`: list of sessions, each with `session_id`, `user_id`, and ordered list of events (`event_name`, `created_at`, `page_path`), capped per session and by number of sessions.

### 3.6 Admin UI (Analytics view)

- **Placement:** Analytics is a **standalone Studio view** (sidebar link “Analytics” below Roadmap). Rendered by `components/studio/views/StudioViewAnalytics.tsx`, which shows `AdminAnalyticsDashboard` (admin-only; non-admins are redirected).
- **Component:** `components/admin/admin-analytics-dashboard.tsx` uses `useAdminEventAnalytics(range)` and optionally `useAdminEventAnalytics(range, true, true)` for time-series. It displays:
  - Range selector (7d / 30d) and **Export CSV** button
  - Summary line (total events in range, unique users/sessions monthly)
  - Active users (daily, weekly, monthly)
  - **Top pages** (page_view by path)
  - All events (by usage, scrollable list)
  - **Feature adoption:** Generate funnel, **Checkout funnel**, **Assistant** (messages sent / responses received), **YouTube connect** (started / completed / failed)
  - Errors (**total in range** and recent table)
  - **Events over time** (toggle to load daily chart; uses `series=1`)
  - **Session journeys** (toggle to load and expand sessions with event lists)
- **Service and hook:** `lib/services/admin-event-analytics.ts` exposes `getAdminEventsAnalytics(range, includeSeries?)` and `getAdminEventsJourneys(...)`. `hooks/use-admin-event-analytics.ts` exposes `useAdminEventAnalytics` and `useAdminEventJourneys`.

### 3.6b GET /api/admin/analytics/events/export (Admin Only)

- **File:** `app/api/admin/analytics/events/export/route.ts`
- **Auth:** `requireAdmin(supabase)`.
- **Query:** `range=7d|30d` (default 30d).
- **Response:** CSV stream (attachment) with columns id, event_name, user_id, session_id, page_path, created_at, properties. Limit 10,000 rows per export.

### 3.7 Account Export (GDPR)

- **File:** `app/api/account/export/route.ts`
- **Change:** After loading other user data, the route uses `createServiceClient()` to select from `analytics_events` where `user_id = user.id`, ordered by `created_at` descending. Only columns `event_name`, `created_at`, `page_path`, `properties` are included (no `session_id` in export). The result is added to the export JSON as `analytics_events`. This supports “export my data” in one place.

### 3.8 User Deletion (GDPR)

- No change to `app/api/account/delete/route.ts`. When a user is deleted via `auth.admin.deleteUser(user.id)`, the FK `user_id REFERENCES auth.users(id) ON DELETE CASCADE` causes all rows in `analytics_events` with that `user_id` to be deleted automatically.

---

## 4. File Reference

| Path | Role |
|------|------|
| `supabase/migrations/017_analytics_events.sql` | Creates table, indexes, RLS, table comment. |
| `types/analytics.ts` | Shared types for track payload, batch, admin responses, export. |
| `lib/analytics/session.ts` | Session ID get/create in `localStorage` (`vb_sid`). |
| `lib/analytics/track.ts` | `track()`, `trackImmediate()`, `setTrackUserId()`, queue and flush. |
| `lib/analytics/session.test.ts` | Unit tests for session ID. |
| `components/analytics-tracker.tsx` | Syncs user to tracker; tracks `page_view` on pathname. |
| `app/providers.tsx` | Renders `AnalyticsTracker` inside `AuthProvider`. |
| `lib/server/utils/rate-limit.ts` | Adds `track` to `RATE_LIMIT_CONFIG`. |
| `app/api/track/route.ts` | POST handler: auth, rate limit, validate, sanitize, insert. |
| `app/api/admin/analytics/events/route.ts` | GET handler: requireAdmin, overview or journeys. |
| `lib/services/admin-event-analytics.ts` | Fetch functions for admin events API. |
| `hooks/use-admin-event-analytics.ts` | React Query hooks for event analytics and journeys. |
| `components/admin/admin-view-content.tsx` | Adds tab content for `analytics` and `AdminAnalyticsDashboard`. |
| `components/admin/admin-analytics-dashboard.tsx` | Analytics tab UI (cards, tables, range). |
| `app/api/account/export/route.ts` | Adds `analytics_events` to export using service client. |
| `docs/analytics.md` | Overview, retention, GDPR, privacy, rate limit. |
| `lib/server/utils/rate-limit.test.ts` | Includes test that `track` route returns 429 when limit exceeded. |

---

## 5. Retention and Future Work

- **Retention:** Events are stored until explicitly deleted. The migration and `docs/analytics.md` recommend a 24-month retention and state that a retention job should live at **`app/api/cron/cleanup-analytics-events/route.ts`** (e.g. Vercel cron), deleting rows where `created_at < now() - interval '24 months'`. This cron is **not** implemented yet; add it when retention is required.
- **Analytics view:** Analytics is a separate Studio view (sidebar link below Roadmap); admins open it from the sidebar. Non-admins are redirected away.

---

## 6. Testing

- **Session:** `lib/analytics/session.test.ts` — getOrCreateSessionId with empty storage, existing value, and short value (replaced).
- **Rate limit:** `lib/server/utils/rate-limit.test.ts` — `enforceRateLimit('track', request, null)` eventually returns 429 with code `RATE_LIMIT_EXCEEDED`.

Run: `npm run test:run -- lib/analytics/session.test.ts lib/server/utils/rate-limit.test.ts`
