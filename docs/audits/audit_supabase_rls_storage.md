# Supabase RLS & Storage Security Audit

**Version:** 2025-01-30  
**Date:** Friday, January 30, 2025

---

**Summary:** ✅ Core tables (profiles, thumbnails, styles, palettes, faces, favorites, experiments, user_subscriptions, analytics_snapshots, notifications, projects, feedback) have RLS in repo. ⚠️ Public read (is_public) not in RLS for thumbnails/styles/palettes—GET /api/thumbnails/public returns no rows for anon. ❌ sync-analytics trusts `body.user_id` when unauthenticated. ❌ No storage policies in repo; tables referenced in code (youtube_*, credit_transactions, referrals, etc.) have no RLS migrations.

---

## Overview

This audit of Row Level Security (RLS) and Storage Access Policies for the Viewbait application reflects the **current in-repo migrations** including `006_rls_core_tables.sql`. ✅ **Core user-scoped tables** (profiles, thumbnails, styles, palettes, faces, favorites, experiments, user_subscriptions, analytics_snapshots) **have RLS enabled and policies** that restrict access to `auth.uid()`. ✅ **notifications** and **projects** have RLS with correct policies; ✅ **feedback** has RLS enabled with no policies (service-role-only access). ⚠️ **Thumbnails, styles, and palettes** RLS policies allow only **own rows** (`user_id = auth.uid()`); the app’s **public** behavior (is_public thumbnails, public styles/palettes) is **not** reflected in RLS—so **GET /api/thumbnails/public** uses the session client and, for **unauthenticated** callers, returns **no rows** (RLS blocks all). Either use the **service client** for that route or add RLS SELECT for `is_public = true`. ❌ **POST /api/experiments/sync-analytics** still accepts **client-provided `user_id`** when the user is unauthenticated, allowing impersonation. ❌ **Storage buckets** (thumbnails, faces, style-references, style-previews) have **no storage policies in repo**; access is enforced only in API routes (path must start with user id). Tables such as **youtube_integrations**, **youtube_channels**, **youtube_analytics**, **credit_transactions**, **referral_codes**, **referrals**, **user_purchases**, **experiment_variants**, **experiment_results**, **stripe_webhook_events**, **subscription_tiers**, **subscription_settings**, and **notification_preferences** are referenced in code but have **no RLS migrations in repo**—if they exist in the live DB, they need RLS. Recommended actions: (1) Fix public thumbnails by using the service client in GET /api/thumbnails/public or add RLS SELECT for `is_public = true` (and optionally for styles/palettes); (2) Remove sync-analytics fallback to `body.user_id` and require authentication; (3) Add storage policies for all buckets using path convention `{user_id}/...`; (4) Add migrations for any tables that exist in DB but lack RLS in repo.

---

## Resource-by-Resource Matrix

### Database tables (in-repo migrations)

| Resource | Intended access | Actual policy (in repo) | Risk | Fix |
|----------|-----------------|--------------------------|------|-----|
| **profiles** | Users read/update own; no self-grant of is_admin | ✅ RLS enabled (006_rls). SELECT/INSERT/UPDATE for authenticated; UPDATE WITH CHECK prevents is_admin change. | ✅ Low | None; keep as-is. |
| **thumbnails** | Users CRUD own; public read for is_public | ⚠️ RLS (006_rls): SELECT only `user_id = auth.uid()`. No SELECT for is_public rows by others/anon. | ⚠️ Medium | Use service client in GET /api/thumbnails/public **or** add RLS SELECT for `user_id = auth.uid() OR is_public = true` (and anon SELECT where is_public = true if needed). |
| **styles** | Users CRUD own; public read for is_public | ⚠️ RLS (006_rls): SELECT only `user_id = auth.uid()`. App uses is_public in API. | ⚠️ Low–Medium | If public styles are read without auth, add SELECT for `user_id = auth.uid() OR is_public = true` or use service client for public listing. |
| **palettes** | Users CRUD own; public read for is_public | ⚠️ Same as styles. | ⚠️ Low–Medium | Same as styles. |
| **faces** | Users CRUD own | ✅ RLS (006_rls). SELECT/INSERT/UPDATE/DELETE where user_id = auth.uid(). | ✅ Low | None. |
| **favorites** | Users CRUD own | ✅ RLS (006_rls). Same pattern. | ✅ Low | None. |
| **experiments** | Users CRUD own | ✅ RLS (006_rls). Same pattern. | ✅ Low | None. |
| **user_subscriptions** | Users read own; service role writes | ✅ RLS (006_rls). SELECT where user_id = auth.uid(); no INSERT/UPDATE/DELETE for authenticated. | ✅ Low | None. |
| **analytics_snapshots** | Read only where user has experiment for video_id | ✅ RLS (006_rls). SELECT via EXISTS on experiments. | ✅ Low | None. |
| **notifications** | Users read/update/delete own; service role inserts | ✅ RLS (001). SELECT/UPDATE/DELETE where user_id = auth.uid(); no INSERT for authenticated. | ✅ Low | None. |
| **projects** | Users CRUD own; public share by slug via service client | ✅ RLS (003). SELECT/INSERT/UPDATE/DELETE where user_id = auth.uid(). Share route uses service client. | ✅ Low | None. |
| **feedback** | Insert-only from API; no direct client access | ✅ RLS enabled (006_create_feedback). No policies = only service role. | ✅ Low | None. |

### Database tables (referenced in code; no RLS in repo)

| Resource | Intended access | Actual policy (in repo) | Risk | Fix |
|----------|-----------------|--------------------------|------|-----|
| **youtube_integrations** | Users read/update own; service for token writes | ❌ No RLS migration in repo. | ❌ High | Enable RLS; SELECT/UPDATE where user_id = auth.uid(); INSERT via service/RPC only. |
| **youtube_channels**, **youtube_analytics** | Per-user or service-only | ❌ No RLS migration in repo. | ❌ High | Enable RLS; restrict by ownership or service role. |
| **credit_transactions** | Users read own; only RPC/service writes | ❌ No RLS migration in repo. | ❌ High | Enable RLS; SELECT where user_id = auth.uid(); no INSERT/UPDATE/DELETE for authenticated. |
| **referral_codes**, **referrals**, **user_purchases** | Per-user or service role | ❌ No RLS migration in repo. | ❌ High | Enable RLS; restrict by user_id or service role. |
| **experiment_variants**, **experiment_results** | Tied to experiments (user-owned) | ❌ No RLS migration in repo. | ❌ High | Enable RLS; SELECT/UPDATE/DELETE only where parent experiment belongs to auth.uid(). |
| **stripe_webhook_events** | Service role only (idempotency) | ❌ No RLS migration in repo. | ❌ High | Enable RLS; no policies for authenticated; service role only. |
| **subscription_tiers**, **subscription_settings** | Read-only reference data | ❌ No RLS migration in repo. | ⚠️ Medium | Enable RLS; SELECT for authenticated/anon if needed; no INSERT/UPDATE/DELETE. |
| **notification_preferences** | Users read/update own | ❌ Referenced in account export; no RLS in repo. | ⚠️ Medium | Enable RLS; SELECT/UPDATE where user_id = auth.uid(). |
| **public_styles**, **public_palettes** (views) | Read-only; public/non-sensitive columns | ❌ No view definitions in repo. | ⚠️ Medium | Ensure views use RLS-safe base tables; expose only intended columns. |

### Storage buckets

| Resource | Intended access | Actual policy (in repo) | Risk | Fix |
|----------|-----------------|--------------------------|------|-----|
| **thumbnails** | Private; path `{user_id}/{id}/...`; user read/write own only | ❌ No storage policy in repo. API validates path. | ❌ High | Add storage policies: SELECT/INSERT/UPDATE/DELETE where first path segment = auth.uid()::text. |
| **faces** | Private; path `{user_id}/...` | ❌ No storage policy in repo. | ❌ High | Same pattern as thumbnails. |
| **style-references** | Private; path `{user_id}/...` | ❌ No storage policy in repo. | ❌ High | Same pattern. |
| **style-previews** | Public read or path `{user_id}/...` | ❌ No storage policy in repo. | ⚠️ Medium | If private: same as above. If public: allow SELECT for all; INSERT/UPDATE/DELETE for own path. |

### Application / API

| Resource | Intended access | Actual behavior | Risk | Fix |
|----------|-----------------|-----------------|------|-----|
| **GET /api/thumbnails/public** | Public list of is_public thumbnails | Uses session client; for unauthenticated, RLS returns no rows. | ⚠️ Medium | Use service client for thumbnails query (and favorites count already uses service client) **or** add RLS SELECT for is_public. |
| **POST /api/experiments/sync-analytics** | Authenticated user syncs own analytics | If not authenticated, uses body.user_id. | ❌ High | Require authentication; remove body user_id fallback. |
| **POST /api/notifications** (broadcast) | Service role only | Uses service role; body.user_id is intentional. | ✅ Acceptable | None. |
| **GET /api/projects/share/[slug]** | Public shared project | Uses service client. | ✅ Acceptable | None. |

---

## Recommended SQL (per fix)

### 1. Thumbnails: Allow public read (optional alternative to service client in API)

If you prefer RLS to allow reading public thumbnails instead of using the service client in GET /api/thumbnails/public:

```sql
-- Allow authenticated users to read own or public thumbnails
DROP POLICY IF EXISTS thumbnails_select_policy ON thumbnails;
CREATE POLICY thumbnails_select_policy ON thumbnails
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);

-- Allow anon to read only public thumbnails (if you want true public API without service client)
DROP POLICY IF EXISTS thumbnails_select_public_policy ON thumbnails;
CREATE POLICY thumbnails_select_public_policy ON thumbnails
  FOR SELECT TO anon
  USING (is_public = true);
```

### 2. Styles / palettes: Allow public read (optional)

If public styles/palettes are read without auth:

```sql
-- Styles: allow reading own or public
DROP POLICY IF EXISTS styles_select_policy ON styles;
CREATE POLICY styles_select_policy ON styles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);

-- Palettes: same
DROP POLICY IF EXISTS palettes_select_policy ON palettes;
CREATE POLICY palettes_select_policy ON palettes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);
```

### 3. Storage: thumbnails bucket (path = {user_id}/...)

```sql
CREATE POLICY "Users can read own thumbnails"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can insert own thumbnails"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own thumbnails"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own thumbnails"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 4. Storage: faces bucket

```sql
CREATE POLICY "Users can read own faces"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'faces' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can insert own faces"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'faces' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own faces"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'faces' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'faces' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own faces"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'faces' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 5. Storage: style-references bucket

```sql
CREATE POLICY "Users can read own style-references"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'style-references' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can insert own style-references"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'style-references' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own style-references"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'style-references' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'style-references' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own style-references"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'style-references' AND (storage.foldername(name))[1] = auth.uid()::text);
```

### 6. Sync-analytics: no SQL

Application change only (see Instructional Prompts below).

---

## Instructional Prompts for a Coding Agent

---

### Fix 1: Public thumbnails — use service client or add RLS

**Prompt:**

```
In viewbait/app/api/thumbnails/public/route.ts, the GET handler lists public thumbnails using createClient() (session client). For unauthenticated callers, RLS on thumbnails allows only user_id = auth.uid(), so no rows are returned. Fix this by either: (A) Using createServiceClient() for the thumbnails .from('thumbnails').select(...).eq('is_public', true) query (and keep the rest of the flow as-is), or (B) Adding a new migration that creates an RLS policy on thumbnails allowing SELECT for anon where is_public = true, and optionally for authenticated where user_id = auth.uid() OR is_public = true (and drop/recreate the existing thumbnails_select_policy to include is_public). Prefer (A) if you want to avoid exposing any direct anon access to the table. Document the choice in a one-line comment in the route.
```

---

### Fix 2: Remove body user_id fallback in sync-analytics

**Prompt:**

```
In viewbait/app/api/experiments/sync-analytics/route.ts, remove the fallback that uses body.user_id when the user is not authenticated. Require authentication: call requireAuth(supabase) (or equivalent from @/lib/server/utils/auth) at the start of the POST handler and use the returned user.id for all operations. Remove the SyncAnalyticsRequest property user_id if it is only used for that fallback. Do not allow unauthenticated callers or client-provided user_id to trigger sync for any user. Update any tests or docs that assumed unauthenticated or body-based user_id behavior.
```

---

### Fix 3: Storage policies for thumbnails, faces, style-references

**Prompt:**

```
Add a new Supabase migration file that defines storage policies for the buckets thumbnails, faces, and style-references. The application uses the path convention {user_id}/... for these private buckets. Create policies on storage.objects so that authenticated users can SELECT, INSERT, UPDATE, and DELETE only objects where the first path segment equals auth.uid()::text. Use Supabase storage policy syntax: (storage.foldername(name))[1] = auth.uid()::text. Use DROP POLICY IF EXISTS for each policy name before CREATE POLICY. Save the migration under supabase/migrations/ with a descriptive name (e.g. 007_storage_rls_policies.sql). If storage.objects already has existing policies with the same names, use distinct names or document that the migration should be run in a clean state.
```

---

### Fix 4: RLS for tables referenced in code but not in migrations

**Prompt:**

```
Review the Viewbait codebase for Supabase table references (e.g. youtube_integrations, youtube_channels, youtube_analytics, credit_transactions, referral_codes, referrals, user_purchases, experiment_variants, experiment_results, stripe_webhook_events, subscription_tiers, subscription_settings, notification_preferences). For each table that exists in the project's Supabase schema but has no RLS migration in supabase/migrations/, add a new migration that: (1) Enables RLS on the table, (2) Creates policies that match the intended access (e.g. user_id = auth.uid() for user-scoped tables, service-role-only for stripe_webhook_events). Use idempotent patterns (DROP POLICY IF EXISTS before CREATE POLICY). Do not invent tables; only add RLS for tables that are confirmed to exist (e.g. from schema dump or existing migrations in other repos). If in doubt, add a single migration file that documents and implements RLS for the most critical user-data tables (youtube_integrations, credit_transactions, referral_codes, referrals, user_purchases, experiment_variants, experiment_results) and note the rest in a comment.
```

---

## Verification steps

1. **Export current RLS state:** Run a query in the Supabase SQL Editor that lists all tables and their RLS status plus policy names (e.g. query `pg_policies` and `pg_tables` for `relrowsecurity`), and save the result for future diff.
2. **Test with two users:** For each user-owned table, log in as user A and verify that user A cannot read or write user B's rows (use Supabase client with anon key and user A's session).
3. **Public thumbnails:** Call GET /api/thumbnails/public unauthenticated; confirm thumbnails with is_public = true are returned after applying Fix 1.
4. **Storage:** For each private bucket, try to read/write an object under another user's path using an authenticated client; expect 403 or empty result after storage policies are applied.
5. **Service role:** Ensure server-side code that must bypass RLS (notifications insert, credits, webhooks, shared project by slug) uses createServiceClient() only and never exposes it to the client.

---

*End of audit.*
