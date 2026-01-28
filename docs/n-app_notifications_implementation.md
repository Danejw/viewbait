# In-App Notifications — Implementation Audit & Integration Guide

This document describes how the in-app notification system works in this application and how to integrate it (or a similar implementation) into another client-side application.

---

## 1. Overview

The in-app notification system delivers real-time notifications using **Supabase** (Postgres + Realtime). Notifications are stored in a `notifications` table, and the UI updates instantly via Supabase Realtime `postgres_changes` subscriptions. Users manage notifications through a **NotificationCenter** modal (tabs: Unread / All / Archived) and a **NotificationBell** in the layout.

**Key characteristics:**

- **Server-only creation**: Notifications are created only on the server (service role or admin broadcast). Clients never insert into `notifications`.
- **Realtime delivery**: The client subscribes to `INSERT` and `UPDATE` on `notifications` filtered by `user_id`, and updates React Query cache so the UI reflects new/updated notifications without a manual refresh.
- **Read/archive via RPC**: Mark-as-read and archive are done through Postgres RPC functions so RLS and ownership are enforced in one place.

---

## 2. Architecture Summary

| Layer | Responsibility |
|-------|----------------|
| **Database** | `notifications` table, RLS, RPCs (`rpc_mark_notification_read`, `rpc_archive_notification`, `rpc_mark_all_notifications_read`), Realtime publication |
| **API** | GET list, POST create (service role), PATCH per-id (read/archive), POST mark-all-read, POST broadcast (admin) |
| **Client service** | `lib/services/notifications.ts` — calls API routes for list, mark read, archive, mark all read |
| **Client hook** | `useNotifications` — React Query + Supabase Realtime subscription; exposes list, unread count, and actions |
| **UI** | `NotificationBell` (badge + open center), `NotificationCenter` (modal with tabs and actions) |

---

## 3. Events That Trigger Notifications (Current State)

**In this codebase, no business logic currently creates notifications.** The plumbing is in place (API routes, Realtime, UI), but there are no call sites that insert a notification when something like "credits added" or "thumbnail ready" happens.

Notifications are created only by:

1. **POST `/api/notifications`**  
   Single notification. Intended for server-side callers only (service role). Body includes `user_id`, `type`, `title`, `body`, and optional `severity`, `icon`, `action_url`, `action_label`, `metadata`.

2. **POST `/api/notifications/broadcast`**  
   One notification to many users. Requires authenticated user with `profiles.is_admin = true`. Body: `notification` object and either `user_ids: string[]` or `audience: 'all'`.

So today, "events" that trigger notifications are only:

- **Explicit server-side create**: Some server code (this app or another backend) calls POST `/api/notifications` or inserts into `notifications` with the service role.
- **Admin broadcast**: An admin calls POST `/api/notifications/broadcast` (e.g. system announcements, feature announcements).

To hook real product events (e.g. "credits added", "generation complete", "subscription renewed"), you would add calls in the appropriate server flows—for example after deducting/adding credits, after a Stripe webhook, or after a background job—using either:

- The same **POST `/api/notifications`** (with `user_id` and payload), or  
- Direct **service-role insert** into `notifications` in your backend.

---

## 4. Database Schema

### 4.1 `notifications` table (from migrations 018–020)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `user_id` | uuid | FK to `auth.users(id)` ON DELETE CASCADE |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()`, trigger-updated |
| `type` | text | `'system' \| 'billing' \| 'reward' \| 'social' \| 'info' \| 'warning'` |
| `title` | text | Required |
| `body` | text | Required |
| `severity` | text | `'info' \| 'success' \| 'warning' \| 'error'`, default `'info'` |
| `icon` | text | Optional client hint |
| `action_url` | text | Optional deep link/route |
| `action_label` | text | Optional button text |
| `metadata` | jsonb | Default `{}` |
| `is_read` | boolean | Default `false` |
| `read_at` | timestamptz | Set when marked read |
| `is_archived` | boolean | Default `false` |
| `archived_at` | timestamptz | Set when archived |

**Indexes:**

- `(user_id, created_at DESC)` — list/pagination
- `(user_id, is_read, created_at DESC)` WHERE `is_read = false` — unread
- `(user_id, is_archived, created_at DESC)` WHERE `is_archived = false` — active list

**Realtime:** Table is added to `supabase_realtime` publication so `postgres_changes` can be used.

### 4.2 RLS

- **SELECT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id` (actual updates go through RPCs)
- **INSERT**: No policy → only service role (or equivalent) can insert
- **DELETE**: Optional policy for own rows (app prefers archive over delete)

### 4.3 RPCs (SECURITY DEFINER, `search_path = public`)

- **`rpc_mark_notification_read(notification_id uuid)`**  
  Sets `is_read = true`, `read_at = now()` for that row when `user_id = auth.uid()` and `is_read = false`. Returns the updated row.

- **`rpc_archive_notification(notification_id uuid)`**  
  Sets `is_archived = true`, `archived_at = now()` for that row when `user_id = auth.uid()` and `is_archived = false`. Returns the updated row.

- **`rpc_mark_all_notifications_read()`**  
  Sets `is_read = true`, `read_at = now()` for all rows where `user_id = auth.uid()` and `is_read = false`. Returns count of updated rows.

---

## 5. API Routes

All routes live under `/api/notifications`. The app uses these from the client via `lib/services/notifications.ts`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/notifications` | Required (user) | List notifications (paginated, filter unread/archived) |
| POST | `/api/notifications` | None (service role only) | Create one notification (body: `NotificationInsert`) |
| PATCH | `/api/notifications/[id]` | Required (user) | Body `{ action: 'read' \| 'archive' }` → calls RPC |
| POST | `/api/notifications/mark-all-read` | Required (user) | Mark all own unread as read |
| POST | `/api/notifications/broadcast` | Required + admin | Broadcast one notification to `user_ids` or `audience: 'all'` |

**GET query params:** `limit`, `offset`, `unreadOnly`, `archivedOnly`.  
**Response (GET):** `{ notifications, count, unreadCount }`.  
**POST create body:** Must include `user_id`, `type`, `title`, `body`; optional `severity`, `icon`, `action_url`, `action_label`, `metadata`.  
**Broadcast body:** `{ user_ids?: string[], audience?: 'all', notification: { type, title, body, severity?, icon?, action_url?, action_label?, metadata? } }`.

---

## 6. Client-Side Implementation (This App)

### 6.1 Service (`lib/services/notifications.ts`)

- **`getNotifications({ limit, offset, unreadOnly, archivedOnly })`**  
  `fetch('/api/notifications?...')` → `{ notifications, count, unreadCount, error }`.

- **`markNotificationAsRead(id)`**  
  `PATCH /api/notifications/[id]` with `{ action: 'read' }` → `{ notification, error }`.

- **`archiveNotification(id)`**  
  `PATCH /api/notifications/[id]` with `{ action: 'archive' }` → `{ notification, error }`.

- **`markAllNotificationsAsRead()`**  
  `POST /api/notifications/mark-all-read` → `{ success, count, error }`.

All calls use the app's origin; cookies/session identify the user for authenticated routes.

### 6.2 Hook (`lib/hooks/useNotifications.ts`)

- **React Query**  
  - Query key: `['notifications', user?.id, limit]`.  
  - Query fn: if `user` exists, call `getNotifications({ limit, offset: 0 })`.  
  - Enabled when `autoFetch && !!user && isAuthenticated`.  
  - Options: `staleTime` 2 min, `refetchOnWindowFocus: true`.

- **Supabase Realtime**  
  - One channel per user: `notifications:${user.id}`.  
  - **postgres_changes** on `public.notifications` with `user_id=eq.${user.id}`:  
    - **INSERT**: Append to list in cache (if not archived), increment unread if not read, avoid duplicates by `id`.  
    - **UPDATE**: Replace row in list by `id`, adjust unread count, remove from list if archived.  
  - On `SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT`, optional refetch for resilience.

- **Mutations**  
  - Mark read, archive, mark all read: call service then `invalidateQueries` for the notifications query key.

- **Returned**  
  - `notifications`, `unreadCount`, `totalCount`, `hasMore`, `isLoading`, `error`, and actions: `markAsRead`, `markAllAsRead`, `archive`, `refresh`.

### 6.3 UI Components

- **NotificationBell**  
  Uses `useNotifications({ autoFetch: true })`, shows bell icon and unread badge (e.g. "99+" when > 99). Click opens the center. Used in `Sidebar` (desktop and mobile).

- **NotificationCenter**  
  Modal; `isOpen` / `onClose` controlled by parent. Uses `useNotifications({ autoFetch: true })`.  
  - Tabs: Unread, All, Archived (filter from same `notifications` array).  
  - List: title, body, time ago, type pill, severity icon; per-row "mark read" and "archive"; optional action button from `action_url` / `action_label`.  
  - Clicking a row marks it read (if unread) and, if `action_url` is set, navigates (e.g. `router.push`) and closes modal.  
  - "Mark all read" when on Unread and there are unread.

So: **one source of truth** is the hook's React Query cache, kept in sync by the initial fetch, Realtime INSERT/UPDATE, and invalidation after mutations.

---

## 7. Realtime Flow (Detail)

1. User is authenticated; `useNotifications` runs with that user's `id`.
2. React Query fetches the first page of notifications from GET `/api/notifications`.
3. Supabase channel `notifications:${user.id}` subscribes to:
   - `postgres_changes` INSERT on `notifications` with `user_id=eq.${user.id}`  
   - `postgres_changes` UPDATE on `notifications` with `user_id=eq.${user.id}`  
4. On INSERT: new row is merged into cache (prepended, unread count updated), so the bell and center update without refetch.
5. On UPDATE: row is replaced in cache; if archived, removed from the "active" list; unread count recalculated.
6. When user marks read/archive or "mark all read", the API calls the RPCs, which perform UPDATEs; Realtime fires UPDATE events, and the hook's handler keeps cache in sync (or invalidation refetches). So the UI stays consistent.

---

## 8. Integrating in Another Client-Side Application

To get the same behavior in another app (e.g. another Next app or a different frontend):

### 8.1 Backend / API Contract

- **Same API contract**  
  Implement (or proxy to) the same routes and request/response shapes:
  - GET `/api/notifications?limit=&offset=&unreadOnly=&archivedOnly=`
  - PATCH `/api/notifications/[id]` with `{ action: 'read' | 'archive' }`
  - POST `/api/notifications/mark-all-read`
  - Optionally POST `/api/notifications` (server-only) and POST `/api/notifications/broadcast` (admin).

- **Same DB and RPCs**  
  If the other app talks to the same Supabase project, reuse the same `notifications` table, RLS, and RPCs. If it's a different project, replicate the schema and RPCs from migrations 018–020 and enable Realtime on `notifications`.

### 8.2 Client Stack Assumptions

- **Auth**  
  Same Supabase auth (or equivalent) so the same `user_id` is used and cookies/session are sent to your API.

- **React Query**  
  Use the same query key shape and similar options (e.g. `['notifications', user?.id, limit]`, staleTime, refetchOnWindowFocus).

- **Supabase client**  
  Create a Supabase client that uses the same project URL and anon key (or the same auth), and subscribe to `postgres_changes` with `user_id=eq.${userId}` for INSERT and UPDATE.

### 8.3 Minimal Client Checklist

1. **Service layer**  
   - `getNotifications(params)` → GET `/api/notifications?...`.  
   - `markNotificationAsRead(id)` → PATCH `/api/notifications/[id]` with `{ action: 'read' }`.  
   - `archiveNotification(id)` → PATCH `/api/notifications/[id]` with `{ action: 'archive' }`.  
   - `markAllNotificationsAsRead()` → POST `/api/notifications/mark-all-read`.

2. **Hook**  
   - One React Query query for the first page of notifications (and optionally more for "load more").  
   - One Realtime channel per user: `postgres_changes` on `notifications` with `user_id=eq.${userId}` for INSERT and UPDATE; update the same query cache (prepend on INSERT, replace/remove on UPDATE, adjust unread count).  
   - Mutations that call the service and then invalidate the notifications query (or rely on Realtime UPDATE).

3. **UI**  
   - A bell (or equivalent) that shows unread count and opens a "center" (modal or drawer).  
   - A list with Unread / All / Archived (or equivalent), same actions: mark read, archive, mark all read, and optional navigation from `action_url` / `action_label`.

### 8.4 Creating Notifications From "Events"

To trigger notifications from product events in this app or another backend:

- **Same backend**  
  After the event (e.g. credits added, subscription renewed), call POST `/api/notifications` with the appropriate `user_id`, `type`, `title`, `body`, and optional fields. Use server-side code and service role (or whatever your POST handler uses to bypass RLS).

- **Different backend**  
  Insert into `notifications` with your Supabase service role (same columns and types). Ensure Realtime is enabled on that table so the client's subscription still receives INSERT/UPDATE.

Use **type** and **severity** consistently (e.g. `reward` + `success` for credits, `billing` + `info` for subscription, `system` + `warning` for maintenance) so the other client can render them the same way (icons, colors, filters).

---

## 9. Environment / Config

- **Client:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or equivalent) for the Supabase client and auth.
- **Server:** `SUPABASE_SERVICE_ROLE_KEY` (or equivalent) for creating notifications and, if you use it, for broadcast. Never expose this to the client.

---

## 10. File Reference (This Repo)

| Purpose | Path |
|---------|------|
| DB migrations | `supabase/migrations/018_create_notifications.sql`, `019_create_notification_policies.sql`, `020_create_notification_functions.sql` |
| API – list/create | `app/api/notifications/route.ts` |
| API – read/archive | `app/api/notifications/[id]/route.ts` |
| API – mark all read | `app/api/notifications/mark-all-read/route.ts` |
| API – broadcast | `app/api/notifications/broadcast/route.ts` |
| Client service | `lib/services/notifications.ts` |
| Client hook | `lib/hooks/useNotifications.ts` |
| Types | `lib/types/database.ts` (`Notification`, `NotificationInsert`, etc.) |
| UI – bell | `app/components/NotificationBell.tsx` |
| UI – center | `app/components/NotificationCenter.tsx` |
| Placement | `app/components/Sidebar.tsx` (NotificationBell + NotificationCenter) |
| Server-side fetch | `lib/server/data/notifications.ts` (e.g. for SSR) |

---

## 11. Summary

- **How it works:** Notifications are rows in `notifications`; created only by server (or admin broadcast); listed and updated (read/archive) via API that uses RPCs; client uses React Query + Realtime to keep the list and unread count in sync.
- **What triggers notifications today:** Only explicit server-side create (POST `/api/notifications` or service-role insert) and admin broadcast (POST `/api/notifications/broadcast`). No automatic triggers from credits, generation, or Stripe in this codebase yet.
- **Integrating elsewhere:** Implement or reuse the same API and DB/RPC/Realtime setup; replicate the service + hook + bell + center pattern so the other client behaves the same way and can receive notifications triggered from any backend that writes to the same `notifications` table.
