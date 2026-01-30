# 🔐 Black-Hat Security Audit Report

**Project:** Viewbait v2  
**Audit date:** Thursday, January 29, 2025  
**Scope:** Backend codebase — API routes, auth, database migrations, RLS, storage, webhooks

---

## 📋 Security Audit Triage Table

| Status | Impact | Issue | Effect | Link to Section |
|--------|--------|-------|--------|-----------------|
| 🔴 Critical | ⬆⬆⬆ Severe | Unauthenticated user_id in sync-analytics | Unauthenticated callers can impersonate any user and trigger YouTube analytics sync / abuse API | [#sync-analytics-bola](#sync-analytics-bola) |
| 🔴 Critical | ⬆⬆⬆ Severe | POST /api/notifications has no auth | Any client (including unauthenticated) can create notifications for any user_id | [#notifications-post-bola](#notifications-post-bola) |
| 🟠 High | ⬆⬆ Major | Process-checkout does not bind session to caller | Authenticated user can pass another user's Stripe session_id and trigger subscription sync for victim | [#process-checkout-session-binding](#process-checkout-session-binding) |
| 🟡 Medium | ⬆ Moderate | Core table RLS not in repo | thumbnails, styles, palettes, profiles, experiments, etc. have no migration/RLS in repo — cannot verify DB-level isolation | [#schema-rls-gap](#schema-rls-gap) |
| 🟡 Medium | ⬆ Moderate | Storage policies not in repo | Buckets (thumbnails, faces, style-references, etc.) have no policy definitions in codebase — cannot verify storage isolation | [#storage-policies-gap](#storage-policies-gap) |
| 🟢 Low | ↓ Minor | No API rate limiting | No application-level rate limiting on public or authenticated endpoints — DoS/abuse easier | [#rate-limiting](#rate-limiting) |

---

## 📖 Detailed Vulnerability Report

---

<a name="sync-analytics-bola"></a>

### 1. 🔴 Sync-analytics: Unauthenticated user_id acceptance (BOLA / impersonation)

#### 1.1 Vulnerability Analysis

- **Vulnerability Name:** Broken Object Level Authorization (BOLA) — unauthenticated `user_id` in POST /api/experiments/sync-analytics  
- **Severity (Status):** 🔴 Critical  
- **Impact:** ⬆⬆⬆ Severe — Unauthenticated callers can pass any `user_id` in the request body. The endpoint then uses that ID to check YouTube connection and obtain an access token for that user, sync analytics for that user’s videos, and write to `analytics_snapshots`. This allows impersonation, API abuse, and data writes tied to arbitrary users.  
- **Description:** In `app/api/experiments/sync-analytics/route.ts`, when `supabase.auth.getUser()` fails or returns no user, the code falls back to `body.user_id`. The comment says “for service calls,” but the route is a normal HTTP POST with no authentication or internal-only check. An attacker can call `POST /api/experiments/sync-analytics` with `{"user_id": "<victim-uuid>"}` and, if the victim has YouTube connected, trigger sync and DB writes for the victim.  
- **Exploitation Steps (Proof of Concept):**

```bash
# Unauthenticated request — replace VICTIM_UUID with a real user ID that has YouTube connected
curl -X POST https://<HOST>/api/experiments/sync-analytics \
  -H "Content-Type: application/json" \
  -d '{"user_id": "VICTIM_UUID"}'
```

- **Root Cause Analysis:** The route treats “not authenticated” as “allow body.user_id.” There is no server-only token or IP allowlist; the route is publicly callable. The design assumes only trusted backends send `user_id`, but the same endpoint is exposed to the internet.

#### 1.2 Remediation Prompt for Coding Agent

- **Context:**  
  - Vulnerability: Unauthenticated callers can supply `user_id` in POST /api/experiments/sync-analytics and trigger YouTube analytics sync (and DB writes) for that user.  
  - File: `viewbait/app/api/experiments/sync-analytics/route.ts`.  
  - Relevant logic: lines ~36–45 where `userId` is set from `body.user_id` when auth fails.  

- **Task:**  
  1. Remove the fallback to `body.user_id` when the user is not authenticated.  
  2. Require authentication for this endpoint: use `requireAuth(supabase)` (or equivalent) and set `userId` only from the authenticated user (e.g. `user.id`).  
  3. If internal/service calls must trigger sync for a specific user, implement a separate, protected mechanism (e.g. internal API key, server-only route, or queue worker with fixed identity), and do not use the same public POST with client-supplied `user_id`.  

- **Desired Outcome:** Only the authenticated user can trigger sync for their own account; unauthenticated requests receive 401 and no sync occurs for any user.

#### 1.3 Verification Test

- **Test method:**  
  1. Call `POST /api/experiments/sync-analytics` with no auth and body `{"user_id": "<valid-user-uuid>"}`. Expect **401** and no sync.  
  2. Call with valid auth cookie/header for User A and no `user_id` in body. Expect sync to run for User A only (or appropriate error if no YouTube).  
  3. Call with valid auth for User A and body `{"user_id": "<user-b-uuid>"}`. Expect sync to run for User A only (ignore body `user_id`).

---

<a name="notifications-post-bola"></a>

### 2. 🔴 POST /api/notifications: No authentication (create notification for any user)

#### 2.1 Vulnerability Analysis

- **Vulnerability Name:** Broken Access Control — unauthenticated creation of notifications for any user  
- **Severity (Status):** 🔴 Critical  
- **Impact:** ⬆⬆⬆ Severe — Any client (including unauthenticated) can send a POST with `user_id` and create a notification for any user. Enables spam, phishing-style content, and abuse of the notification system.  
- **Description:** In `app/api/notifications/route.ts`, the POST handler does not call `requireAuth()`. It uses the service role client and inserts `body.user_id` into the `notifications` table. The comment says “should only be called from server-side code,” but the route is a normal HTTP endpoint with no authentication or server-only check.  
- **Exploitation Steps (Proof of Concept):**

```bash
curl -X POST https://<HOST>/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "VICTIM_UUID",
    "type": "info",
    "title": "Fake alert",
    "body": "Phishing or spam content"
  }'
```

- **Root Cause Analysis:** POST was designed for server-side use (e.g. after Stripe events) but was exposed as a public API without requiring a secret, auth, or server-only path. Trust is assumed instead of enforced.

#### 2.2 Remediation Prompt for Coding Agent

- **Context:**  
  - Vulnerability: POST /api/notifications accepts unauthenticated requests and creates notifications for any `user_id`.  
  - File: `viewbait/app/api/notifications/route.ts`, POST handler (e.g. lines ~104–181).  

- **Task:**  
  1. Do not allow unauthenticated or arbitrary clients to create notifications. Choose one of:  
     - **Option A:** Remove this public POST and create notifications only from server-side code (e.g. Stripe webhook handler, cron, or other server routes) that call the service role client directly, not via this HTTP endpoint.  
     - **Option B:** Restrict this endpoint to internal use: require a shared secret header (e.g. `X-Internal-Secret`) or run it only on an internal URL; validate the secret before using `body.user_id`.  
  2. If Option B, ensure the secret is stored in env and never sent to the client.  
  3. Ensure no other public path allows arbitrary `user_id` notification creation without the same protection.  

- **Desired Outcome:** Only trusted server-side callers (or callers with a valid internal secret) can create notifications for a given user; unauthenticated public requests cannot create any notification.

#### 2.3 Verification Test

- **Test method:**  
  1. Call `POST /api/notifications` with no auth and a valid body including `user_id`. Expect **401** or **403** and no new row in `notifications`.  
  2. If using a secret: call without the secret → rejected; call with correct `X-Internal-Secret` (or equivalent) → allowed for the given `user_id`.  
  3. Verify that existing server-side notification creation (e.g. from webhooks or cron) still works.

---

<a name="process-checkout-session-binding"></a>

### 3. 🟠 Process-checkout: Session not bound to authenticated user

#### 3.1 Vulnerability Analysis

- **Vulnerability Name:** Broken Object Level Authorization — process-checkout accepts any Stripe session_id without verifying ownership  
- **Severity (Status):** 🟠 High  
- **Impact:** ⬆⬆ Major — An authenticated user can pass another user’s completed Stripe checkout `session_id`. The backend uses `session.metadata.user_id` from Stripe and updates that user’s subscription in the DB. Attacker can trigger subscription sync for a victim (confusion, unnecessary writes, or abuse of side effects).  
- **Description:** In `app/api/process-checkout/route.ts`, the handler requires auth and then calls `processCheckoutSession(body.sessionId)`. In `lib/services/stripe.ts`, `processCheckoutSession` uses `session.metadata?.user_id` from Stripe and does not compare it to the authenticated caller. So the subscription update is applied to the user in the session metadata, not necessarily the caller.  
- **Exploitation Steps (Proof of Concept):**

```javascript
// As authenticated User A, pass User B's completed checkout session_id
await fetch('/api/process-checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ sessionId: 'cs_xxx_from_victim_checkout' })
})
// Backend will update victim's subscription record, not attacker's
```

- **Root Cause Analysis:** The route ensures “someone is logged in” but does not ensure “this session belongs to this user.” Ownership should be enforced by requiring `session.metadata.user_id === auth.uid()`.

#### 3.2 Remediation Prompt for Coding Agent

- **Context:**  
  - Vulnerability: An authenticated user can pass any valid Stripe checkout `session_id` and trigger subscription sync for the user in that session’s metadata.  
  - Files: `viewbait/app/api/process-checkout/route.ts`, `viewbait/lib/services/stripe.ts` (e.g. `processCheckoutSession`).  

- **Task:**  
  1. After retrieving the Stripe session in `processCheckoutSession`, compare `session.metadata?.user_id` to the authenticated user id passed from the route.  
  2. In the route: pass the authenticated `user.id` into `processCheckoutSession(sessionId, callerUserId)`.  
  3. In `processCheckoutSession`: if `session.metadata?.user_id !== callerUserId`, return a failure (e.g. “Session does not belong to the current user”) and do not update the DB.  
  4. Ensure the route only calls `processCheckoutSession` with the authenticated user’s id.  

- **Desired Outcome:** Only the user who owns the Stripe checkout session (metadata.user_id) can complete process-checkout for that session; others receive an error and no DB update.

#### 3.3 Verification Test

- **Test method:**  
  1. As User A, complete a checkout and obtain `session_id` (e.g. from success URL). Call POST /api/process-checkout with that session_id as User A → success.  
  2. As User B (authenticated), call POST /api/process-checkout with User A’s session_id → expect 403 or 400 with a clear error and no change to User A’s subscription from this call.  
  3. As User A, call with User A’s session_id again → still success (idempotent where applicable).

---

<a name="schema-rls-gap"></a>

### 4. 🟡 Core table RLS not defined in repository

#### 4.1 Vulnerability Analysis

- **Vulnerability Name:** Database schema and RLS for core tables not in repo  
- **Severity (Status):** 🟡 Medium  
- **Impact:** ⬆ Moderate — Cannot verify from codebase that tables such as `thumbnails`, `styles`, `palettes`, `profiles`, `experiments`, `user_subscriptions`, `analytics_snapshots`, `favorites`, `faces` have RLS enabled and correct policies. If RLS is missing or wrong in the deployed DB, API bugs or future client access could lead to cross-user data access.  
- **Description:** The repo’s `supabase/migrations` contain only `001_create_notifications.sql` (notifications table + RLS) and `002_add_profiles_is_admin.sql` (profiles column). Tables and RLS for thumbnails, styles, palettes, profiles (full table), experiments, user_subscriptions, etc. are not present. Application code uses these tables and enforces ownership in API routes (e.g. `.eq('user_id', user.id)`), but the database security principles doc requires RLS as the primary boundary.  
- **Root Cause Analysis:** Schema and RLS may have been created in the Supabase dashboard or out-of-band SQL, so the repo does not serve as the single source of truth for DB security.

#### 4.2 Remediation Prompt for Coding Agent

- **Context:**  
  - Issue: Core tables and their RLS are not defined in the repo.  
  - Reference: `docs/database_security_principles.md` and existing pattern in `001_create_notifications.sql`.  

- **Task:**  
  1. Add migrations (or document in a single migration/schema dump) for every user-scoped table: at minimum `profiles`, `thumbnails`, `styles`, `palettes`, `faces`, `favorites`, `experiments`, `user_subscriptions`, and any other tables that store data keyed by `user_id`.  
  2. For each such table: enable RLS and add policies so that `authenticated` users can only SELECT/INSERT/UPDATE/DELETE rows where `user_id = auth.uid()`.  
  3. Do not allow INSERT/UPDATE with a different `user_id` (enforce via WITH CHECK where applicable).  
  4. Ensure `profiles` allows users to read/update their own row only (and restrict who can set `is_admin`).  

- **Desired Outcome:** All user data tables have RLS defined in the repo and deployed; the repo is the source of truth for DB-level isolation.

#### 4.3 Verification Test

- **Test method:**  
  1. In Supabase SQL editor, as a role with RLS: set `request.jwt.claim.sub` to user A’s id; SELECT from thumbnails/styles/palettes/etc. — only A’s rows.  
  2. Set JWT to user B; same queries — only B’s rows.  
  3. As user B, attempt UPDATE thumbnails SET title = 'x' WHERE user_id = '<user-a-id>' — should affect 0 rows (or deny).

---

<a name="storage-policies-gap"></a>

### 5. 🟡 Storage bucket policies not in repository

#### 5.1 Vulnerability Analysis

- **Vulnerability Name:** Storage access policies not defined in codebase  
- **Severity (Status):** 🟡 Medium  
- **Impact:** ⬆ Moderate — Buckets such as `thumbnails`, `faces`, `style-references`, `style-previews` are referenced in code but their policies are not in the repo. Cannot verify that object access is restricted by `user_id` or equivalent; wrong policies could allow read/write across users.  
- **Description:** Application code uses `supabase.storage.from('thumbnails')`, etc., and some routes use service role for uploads. There are no migration or SQL files in the audited repo that define `storage.buckets` or `storage.objects` policies.  
- **Root Cause Analysis:** Policies may be configured only in the Supabase dashboard.

#### 5.2 Remediation Prompt for Coding Agent

- **Context:**  
  - Issue: Storage policies for thumbnails, faces, style-references, style-previews are not in repo.  
  - Supabase allows defining storage policies via SQL (e.g. in migrations).  

- **Task:**  
  1. Add migration(s) or documented SQL that define, for each bucket:  
     - Who can INSERT (e.g. authenticated users into their own path prefix `user_id/...`).  
     - Who can SELECT (e.g. authenticated user for their own prefix; or public read for specific paths if required).  
     - Who can UPDATE/DELETE (e.g. owner only).  
  2. Use `auth.uid()` and path conventions (e.g. `(bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text)`) to scope access.  
  3. Document any bucket that intentionally allows public read and why.  

- **Desired Outcome:** Storage policies are versioned in repo and enforce per-user isolation (or documented public access) for all buckets in use.

#### 5.3 Verification Test

- **Test method:**  
  1. With Supabase client as User A, attempt to read an object in path `user-b-id/...` → expect denial (unless policy explicitly allows).  
  2. As User A, upload to `user-a-id/...` → success.  
  3. As User A, delete or overwrite object in `user-b-id/...` → expect denial.

---

<a name="rate-limiting"></a>

### 6. 🟢 No application-level API rate limiting

#### 6.1 Vulnerability Analysis

- **Vulnerability Name:** No rate limiting on API routes  
- **Severity (Status):** 🟢 Low  
- **Impact:** ↓ Minor — Easier to abuse endpoints (e.g. sync-analytics, generate, or notifications if fixed) with high request volume; no application-level throttle for DoS or cost abuse.  
- **Description:** No `rateLimit`, `rate-limit`, or similar middleware was found on API routes. Reliance is on hosting/infra (e.g. Vercel) for basic limits.  
- **Root Cause Analysis:** Rate limiting was not implemented in the app layer.

#### 6.2 Remediation Prompt for Coding Agent

- **Context:**  
  - Issue: No per-IP or per-user rate limiting on API routes.  
  - Prefer a small, consistent pattern (e.g. middleware or wrapper) so limits can be applied to sensitive routes.  

- **Task:**  
  1. Introduce a rate-limiting mechanism (e.g. `@upstash/ratelimit` or similar) for key routes (e.g. /api/generate, /api/experiments/sync-analytics, /api/notifications if kept internal-only).  
  2. Apply limits per authenticated user (and optionally per IP for unauthenticated).  
  3. Return 429 with Retry-After when exceeded.  

- **Desired Outcome:** High-volume abuse of sensitive endpoints is throttled and returns 429.

#### 6.3 Verification Test

- **Test method:**  
  1. Send a large number of requests to a rate-limited endpoint in a short window → expect 429 after threshold.  
  2. After cooldown, next request → 200 (or appropriate success).

---

## ✅ Positive Findings

- **Stripe webhook:** Signature verification with `stripe.webhooks.constructEvent(body, signature, webhookSecret)` is used; no processing without verification.  
- **Notifications broadcast:** Admin-only path requires auth and checks `profiles.is_admin` before using service role.  
- **Auth pattern:** Most routes use `requireAuth(supabase)` and then scope queries with `user.id` (e.g. thumbnails, styles, palettes).  
- **Notifications RLS:** `001_create_notifications.sql` enables RLS and restricts SELECT/UPDATE/DELETE to `user_id = auth.uid()`; INSERT is service-role only.  
- **RPC functions:** `rpc_mark_notification_read`, `rpc_archive_notification`, `rpc_mark_all_notifications_read` use `SECURITY DEFINER` with `auth.uid()` checks and `search_path = public`.  
- **Service role:** Used only in server-side code; `createServiceClient()` reads from env and is not exposed to the client.

---

## 📌 Summary

- **Critical (2):** Fix unauthenticated `user_id` in sync-analytics and add auth or remove public POST for notifications.  
- **High (1):** Bind process-checkout to the authenticated user so only the session owner can complete it.  
- **Medium (2):** Put core table RLS and storage policies in repo and deploy so DB and storage isolation are verifiable.  
- **Low (1):** Add rate limiting on sensitive API routes.

After remediation, re-run the verification tests above and re-audit any new endpoints or tables.
