# In-App Notifications — Audit, Architecture & Event Rubric

This document audits the in-app notifications feature, describes how it is implemented, how to expand it, and provides a **rubric** for deciding when and what kind of notification events to create for new features.

---

## 1. Feature Audit: How In-App Notifications Are Implemented

### 1.1 Overview

The in-app notification system is a **user-scoped, real-time capable** feature that:

- Stores notifications in a `notifications` table (Supabase/Postgres).
- Exposes **read-only + update** access to users via RLS; **inserts are server-side only** (service role).
- Serves list/read/archive via API routes; UI is a bell + popover with tabs (Unread / All / Archived).
- Optionally uses **Supabase Realtime** for live updates when new rows are inserted or updated for the current user.

**Current state:** The pipeline for **creating** notifications is implemented (POST API + broadcast), but **no feature workflows in the app yet create notifications**. Notifications are created only when:

1. Something server-side calls `POST /api/notifications` with a valid `NotificationInsert` (service role).
2. An admin calls `POST /api/notifications/broadcast` to send to many users (or audience `"all"`).

So the “event” side is **ready to be wired** from features (e.g. generation complete, credits low, referral rewarded); the doc below and the rubric clarify where and how to do that.

---

### 1.2 Data Layer

| Layer | Location | Purpose |
|-------|----------|--------|
| **Table** | `supabase/migrations/001_create_notifications.sql` | `notifications` schema, indexes, RLS, RPCs |
| **Types** | `lib/types/database.ts` | `Notification`, `NotificationInsert`, `NotificationUpdate`, `NotificationPreferences` |
| **RLS** | Same migration | SELECT/UPDATE/DELETE for own `user_id`; no INSERT for authenticated (service role only) |

**Schema (relevant fields):**

- `id`, `user_id`, `created_at`, `updated_at`
- `type`, `title`, `body`, `severity`, `icon`, `action_url`, `action_label`, `metadata`
- `is_read`, `read_at`, `is_archived`, `archived_at`
- DB constraints: `type` ∈ `('system', 'billing', 'reward', 'social', 'info', 'warning')`, `severity` ∈ `('info', 'success', 'warning', 'error')`

**RPCs (used by API):**

- `rpc_mark_notification_read(notification_id)` — mark one as read.
- `rpc_archive_notification(notification_id)` — archive one.
- `rpc_mark_all_notifications_read()` — mark all unread as read for the current user.

**Indexes:** User + created_at; partial indexes for unread and non-archived for efficient listing and unread count.

---

### 1.3 API Layer

| Route | Method | Auth | Purpose |
|-------|--------|------|--------|
| `/api/notifications` | GET | User (requireAuth) | List notifications (paginated), unread count; optional filters `unreadOnly`, `archivedOnly` |
| `/api/notifications` | POST | Service role only | Create one notification (validated `NotificationInsert`) |
| `/api/notifications/broadcast` | POST | User + `is_admin` | Broadcast one notification to many users (`user_ids[]` or `audience: "all"`) |
| `/api/notifications/[id]` | PATCH | User | Mark as read or archive (body: `{ action: 'read' \| 'archive' }`) |
| `/api/notifications/mark-all-read` | POST | User | Mark all unread as read |

- **Creating notifications:** Only via POST (single) or broadcast; both use service role for insert. No direct client-side create.
- **Server-side fetch:** `lib/server/data/notifications.ts` — `fetchNotifications`, `fetchUnreadCount` (for SSR if needed).

---

### 1.4 Client Layer

| Piece | Location | Responsibility |
|-------|----------|-----------------|
| **Service** | `lib/services/notifications.ts` | `getNotifications`, `markNotificationAsRead`, `archiveNotification`, `markAllNotificationsAsRead` — all call the API routes above |
| **Hook** | `lib/hooks/useNotifications.ts` | React Query for list + unread count; mutations for read/archive/mark-all-read; **Realtime** subscription for `INSERT`/`UPDATE` on `notifications` for current user; cache key `['notifications', user?.id, limit]` |
| **UI** | `components/notifications/` | `NotificationBell` (trigger + badge), `NotificationPopover` (tabs: Unread, All, Archived), `NotificationItem` (row with type/severity, time, action link, archive) |
| **Placement** | `components/studio/studio-sidebar.tsx` | `NotificationBell` in sidebar (and in compact nav) |

**Realtime:** The hook subscribes to `postgres_changes` on `notifications` with `user_id=eq.<user.id>`. On INSERT it prepends to cache and bumps unread count; on UPDATE it updates the row and recalculates unread/archived. If Realtime is not enabled for the table, the app still works via refetch (e.g. on focus, or on subscription error).

---

### 1.5 Notification Types and Severity (Current)

- **Types (DB + API):** `system`, `billing`, `reward`, `social`, `info`, `warning`
- **Severity:** `info`, `success`, `warning`, `error`
- **UI:** `NotificationItem` maps type to icon (e.g. billing → CreditCard, reward → Gift) and severity to color/icon (e.g. success → green, error → red).

---

### 1.6 What Is Not Yet Wired

- **No feature-originated events:** No code path in the app (e.g. after generation, purchase, referral reward) currently calls the create-notification API.
- **Notification preferences:** `notification_preferences` (and types) exist and are exported in account export; they are **not** yet used to filter or gate in-app notifications. Future expansion can respect `in_app_enabled` and `types_enabled` before inserting or when returning list.
- **Realtime:** Must be enabled in Supabase (Replication) for `notifications` if live updates are desired; otherwise polling/refetch is used.

---

## 2. How to Expand the Feature

### 2.1 Adding a New Notification From a Feature (Server-Side)

1. **Where:** In the **server-side** code path that completes the meaningful event (e.g. API route, server action, webhook handler, background job).
2. **How:** Call `POST /api/notifications` with a body that conforms to `NotificationInsert`. The route uses the **service role** client, so it must be invoked from the server (e.g. `fetch` from a route handler to your own API, or a shared server-side helper that uses the service role Supabase client to insert into `notifications`).
3. **Payload:** Include at least `user_id`, `type`, `title`, `body`; set `severity`, `action_url`, `action_label`, `metadata` as needed.
4. **Idempotency:** For events that might be processed more than once (e.g. webhooks), consider storing a unique key in `metadata` and skipping creation if a notification with that key already exists for that user/type.

### 2.2 Adding a New Type or Severity

- **DB:** If you need a new `type` or `severity`, add it to the CHECK constraints in a new migration and update `lib/types/database.ts` to match.
- **API:** The route validates against the same sets; update validation when you extend the enum.
- **UI:** Extend `getTypeIcon` / `getSeverityStyles` in `notification-item.tsx` (and any filters) for the new values.

### 2.3 Respecting Notification Preferences (Future)

- When creating a notification, or in a central “send notification” helper, query `notification_preferences` for the user and skip (or downgrade) if `in_app_enabled` is false or the notification `type` is disabled in `types_enabled`.
- Optionally, when returning the list in GET, filter by the same preferences so the user only sees what they opted into.

### 2.4 Broadcast and Admin Flows

- Use `POST /api/notifications/broadcast` for one-off or admin-driven announcements (e.g. maintenance, new feature). Payload: `notification` object + either `user_ids` or `audience: "all"`.
- For more complex audiences (e.g. by plan, by segment), extend the route to resolve `audience` to a list of `user_id`s and then batch-insert as today.

---

## 3. Rubric: When to Create an Event and What Kind

Use this rubric when building new features to decide **whether** to add a notification event and **what type/severity** to use.

### 3.1 Should We Create a Notification for This Feature?

Ask these questions; if most answers are “yes” or “relevant,” add an event.

| Question | If yes → |
|----------|-----------|
| Does the event **change something important** for the user (e.g. credits, subscription, content ready, reward)? | Strong candidate for a notification. |
| Would the user **benefit from seeing it later** if they’re not on the right screen (e.g. “Your thumbnail is ready”)? | Create a notification. |
| Is the event **triggered asynchronously** (webhook, job, background) so the user might miss it in the UI? | Create a notification. |
| Is it **actionable** (e.g. “Top up credits,” “View result,” “Claim reward”)? | Prefer notification with `action_url` / `action_label`. |
| Is it **rare and high-signal** (e.g. billing issue, reward, quota warning) rather than noisy? | Prefer notification. |
| Is it **purely decorative or ephemeral** (e.g. “You clicked a button”) and already visible on screen? | Usually **no** notification. |
| Is it **high-frequency** (e.g. every save, every keystroke)? | Prefer **no** notification, or aggregate (e.g. daily digest) if ever. |

**Summary rule:** Create a notification when the event is **meaningful, asynchronous or easy to miss, and/or actionable**. Skip when it’s ephemeral, purely UI, or too frequent.

---

### 3.2 What Type Should the Notification Be?

Map the **domain** of the event to one of the existing (or future) types. Keep types stable so we can filter and respect preferences later.

| Domain / Meaning | Suggested `type` | When to use |
|------------------|-------------------|-------------|
| Billing, payment, subscription, plan, invoice | `billing` | Payments, renewals, failures, plan changes |
| Credits, rewards, referrals, gifts | `reward` | Referral rewarded, credits added, bonus |
| Other users, social, mentions, shares | `social` | Social features (when added) |
| Product/feature announcements, maintenance, policy | `system` | Platform-wide or important product news |
| Generic informational update | `info` | General updates (e.g. “Something completed”) |
| Warnings, limits, quotas, deprecations | `warning` | “Credits low,” “Limit soon,” “Deprecation” |

If you introduce a new domain (e.g. “content” or “security”), add a new type via migration + validation + UI and use it consistently.

---

### 3.3 What Severity Should We Use?

| User impact | Suggested `severity` | Examples |
|-------------|----------------------|----------|
| Neutral / FYI | `info` | “Your export is ready,” “New feature available” |
| Positive outcome | `success` | “Payment received,” “Reward claimed,” “Generation complete” |
| Needs attention but not urgent | `warning` | “Credits low,” “Trial ending soon,” “Limit in 2 days” |
| Error or critical issue | `error` | “Payment failed,” “Action failed,” “Account issue” |

Use **error** sparingly; reserve for things that require action or that the user must not miss.

---

### 3.4 Checklist for Implementing a New Notification Event

- [ ] **Trigger:** Identify the single server-side place where the “event” is definitive (e.g. webhook handler, API route after success).
- [ ] **Payload:** Set `user_id`, `type`, `title`, `body`; add `severity`, `action_url`, `action_label` if applicable; put idempotency or context in `metadata` if needed.
- [ ] **Idempotency:** For retryable flows, use `metadata` (e.g. `{ source: 'stripe', event_id: 'evt_...' }`) and avoid duplicate notifications for the same event.
- [ ] **Preferences (future):** When preference checks exist, run them before inserting.
- [ ] **Testing:** Trigger the flow and confirm one notification appears in the bell; confirm mark-read and archive work; confirm Realtime if enabled.

---

## 4. File Reference (Quick Index)

| Concern | Path |
|--------|------|
| DB schema, RLS, RPCs | `supabase/migrations/001_create_notifications.sql` |
| Types | `lib/types/database.ts` (Notification, NotificationInsert, NotificationPreferences) |
| API list/create | `app/api/notifications/route.ts` |
| API broadcast | `app/api/notifications/broadcast/route.ts` |
| API by id (read/archive) | `app/api/notifications/[id]/route.ts` |
| API mark all read | `app/api/notifications/mark-all-read/route.ts` |
| Server-side fetch | `lib/server/data/notifications.ts` |
| Client service | `lib/services/notifications.ts` |
| Hook (query + realtime + mutations) | `lib/hooks/useNotifications.ts` |
| UI bell + popover + item | `components/notifications/*` |
| Sidebar usage | `components/studio/studio-sidebar.tsx` |

---

## 5. Summary

- **Current implementation:** End-to-end pipeline exists (DB, RLS, RPCs, API, service, hook, Realtime, UI). Creation is server-only; no in-app features yet create notifications.
- **Expansion:** Add creation in server-side feature code; optionally extend types/severity and respect `notification_preferences`; use broadcast for admin/announcements.
- **Rubric:** Create notifications for **meaningful, asynchronous or easy-to-miss, actionable** events; choose **type** by domain (billing, reward, system, info, warning) and **severity** by impact (info, success, warning, error). Use the checklist when implementing each new event.

This document should be updated when new notification types are added, when preferences are enforced, or when the rubric is refined based on product decisions.
