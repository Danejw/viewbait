# Supabase RLS & Storage Security Audit

**Version:** 2025-01-29  
**Date:** Thursday, January 29, 2025

---

## Methodology

The **Supabase MCP** was used to discover database structure and RLS capabilities: `list_projects`, `list_tables` (with `rls_enabled` per table), and `list_migrations` were invoked. The project ref configured in this repo (`.env`: `eqxagfhgfgrcdbtmxepl`) returned *"You do not have permission to perform this action"* when queried via the connected MCP account, so **audit findings are based on in-repo migrations, application code references, and (where available) MCP schema/rls_enabled patterns**. For a project that was accessible via MCP, `list_tables` confirmed that tables can report `rls_enabled: true/false` and that tables with RLS disabled (e.g. rate-limit or nonce tables) represent a deliberate pattern to avoid for user data.

---

## Overview

This audit of Row Level Security (RLS) and Storage Access Policies for the Viewbait application found **two database objects with correct, in-repo RLS** (✅ **notifications** and **projects**), and **multiple tables and all four storage buckets** with **no RLS or storage policies defined in the repository** (❌/⚠️), creating risk of unauthorized read/write if RLS is not enabled and properly configured in Supabase. **Profiles** is modified by a migration (e.g. `is_admin`) but has **no RLS enable or policies in repo** (⚠️). **Storage buckets** (thumbnails, faces, style-references, style-previews) have **no storage policies in repo**; private buckets rely on server-side routes and path conventions, so storage RLS is recommended to enforce per-user access at the storage layer. One **API route** (POST `/api/experiments/sync-analytics`) accepts **client-provided `user_id` when the user is unauthenticated** (❌), which can allow arbitrary user impersonation for analytics sync. Recommended actions: (1) run an RLS export query in Supabase and persist results for future diff; (2) add migrations that enable RLS and define policies for every user-owned table and for storage buckets using the path convention `{user_id}/...`; (3) remove or secure the sync-analytics fallback so only authenticated users can sync their own analytics.

---

## Resource-by-Resource Matrix

### Database tables

| Resource | Intended access | Actual policy (in repo) | Risk | Fix |
|----------|-----------------|--------------------------|------|-----|
| **notifications** | Users read/update/delete own rows; only service role inserts | ✅ RLS enabled. SELECT/UPDATE/DELETE for authenticated with `user_id = auth.uid()`. No INSERT for authenticated. | ✅ Low | None; keep as-is. |
| **projects** | Users CRUD own rows only | ✅ RLS enabled (migration 003). SELECT/INSERT/UPDATE/DELETE for authenticated with `user_id = auth.uid()`. | ✅ Low | None; keep as-is. |
| **profiles** | Users read/update own row; service role for admin fields | ⚠️ Migration 002 only adds `is_admin`. No RLS enable or policies in repo. | ⚠️ High if RLS not enabled in Supabase | Enable RLS; add SELECT/UPDATE for own row using `id = auth.uid()`. |
| **thumbnails** | Users CRUD own rows; public read for `is_public` rows | ❌ No RLS migration or policies in repo (003 only adds `project_id`). | ❌ High | Enable RLS; SELECT own or public; INSERT/UPDATE/DELETE own only. |
| **user_subscriptions** | Users read own; only service role writes | ❌ No migration or policies in repo. | ❌ High | Enable RLS; SELECT where `user_id = auth.uid()`; no INSERT/UPDATE/DELETE for authenticated. |
| **styles** | Users CRUD own; public read for public styles (view) | ❌ No migration or policies in repo. | ❌ High | Enable RLS; SELECT own or via public_styles; INSERT/UPDATE/DELETE own only. |
| **palettes** | Users CRUD own; public read for public palettes (view) | ❌ No migration or policies in repo. | ❌ High | Enable RLS; SELECT own or via public_palettes; INSERT/UPDATE/DELETE own only. |
| **faces** | Users CRUD own rows | ❌ No migration or policies in repo. | ❌ High | Enable RLS; SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()`. |
| **favorites** | Users CRUD own favorite rows | ❌ No migration or policies in repo. | ❌ High | Enable RLS; SELECT/INSERT/UPDATE/DELETE where `user_id = auth.uid()`. |
| **youtube_integrations** | Users read/update own; service role for token writes | ❌ No migration or policies in repo. | ❌ High | Enable RLS; SELECT/UPDATE own; INSERT only service role or RPC. |
| **youtube_channels**, **youtube_analytics** | Per-user or service-only | ❌ No migration or policies in repo. | ❌ High | Enable RLS; restrict to own user or service role. |
| **credit_transactions** | Users read own; only RPC/service role writes | ❌ No migration or policies in repo. | ❌ High | Enable RLS; SELECT where `user_id = auth.uid()`; no direct INSERT/UPDATE/DELETE for authenticated. |
| **referral_codes**, **referrals**, **user_purchases** | Per-user or service role | ❌ No migration or policies in repo. | ❌ High | Enable RLS; restrict by `user_id` or service role. |
| **experiments**, **experiment_variants**, **experiment_results**, **analytics_snapshots** | Per-user or service | ❌ No migration or policies in repo. | ❌ High | Enable RLS; restrict by ownership or service role. |
| **stripe_webhook_events** | Service role only (idempotency) | ❌ No migration or policies in repo. | ❌ High | Enable RLS; no policies for authenticated; service role only. |
| **subscription_tiers**, **subscription_settings** | Read-only for app; no user rows | ❌ No migration or policies in repo. | ⚠️ Medium | Enable RLS; SELECT for authenticated (or anon) if needed; no INSERT/UPDATE/DELETE. |
| **public_styles**, **public_palettes** (views) | Read-only; only public/non-sensitive columns | ❌ No view definitions or underlying RLS in repo. | ⚠️ Medium | Ensure views use RLS-safe underlying tables; expose only intended columns. |
| **notification_preferences** (if exists) | Users read/update own | ❌ Referenced in account export; no RLS in repo. | ⚠️ Medium | Enable RLS; SELECT/UPDATE where `user_id = auth.uid()`. |

### Storage buckets

| Resource | Intended access | Actual policy (in repo) | Risk | Fix |
|----------|-----------------|--------------------------|------|-----|
| **thumbnails** | Private; path `{user_id}/{id}/...`; user read/write own path only | ❌ No storage policy in repo. | ❌ High | Add policy: SELECT/INSERT/UPDATE/DELETE where `(bucket_id = 'thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text)`. |
| **faces** | Private; path `{user_id}/...`; user read/write own path only | ❌ No storage policy in repo. | ❌ High | Same pattern: first path segment = `auth.uid()::text`. |
| **style-references** | Private; path includes user; user read/write own path only | ❌ No storage policy in repo. | ❌ High | Same pattern: enforce first folder = user id. |
| **style-previews** | Public read or private; path `{user_id}/...` if private | ❌ No storage policy in repo. | ⚠️ Medium | If private: same as above. If public read: allow SELECT for all; INSERT/UPDATE/DELETE for own path. |

### Application / API

| Resource | Intended access | Actual behavior | Risk | Fix |
|----------|-----------------|-----------------|------|-----|
| **POST /api/experiments/sync-analytics** | Authenticated user syncs own analytics | ⚠️ If not authenticated, uses `body.user_id` for "service calls". | ❌ High | Require authentication; remove fallback to body `user_id`. |
| **POST /api/notifications** (broadcast) | Service role only; body includes `user_id` for target | Uses service role; body.user_id is intentional for broadcast. RLS on notifications has no INSERT for authenticated. | ✅ Acceptable | None; keep service role and validate body server-side. |

---

## Recommended SQL (per fix)

### 1. profiles: Enable RLS and add policies

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile (e.g. full_name, avatar_url; restrict is_admin updates via trigger or app)
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No INSERT/DELETE for authenticated (profiles created by trigger or service role)
```

### 2. thumbnails: Enable RLS and add policies

```sql
ALTER TABLE thumbnails ENABLE ROW LEVEL SECURITY;

CREATE POLICY thumbnails_select_own_or_public ON thumbnails
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY thumbnails_insert_own ON thumbnails
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY thumbnails_update_own ON thumbnails
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY thumbnails_delete_own ON thumbnails
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

### 3. user_subscriptions: Enable RLS (read-only for users)

```sql
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_subscriptions_select_own ON user_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for authenticated; only service role / RPC.
```

### 4. styles: Enable RLS and add policies

```sql
ALTER TABLE styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY styles_select_own_or_public ON styles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY styles_insert_own ON styles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY styles_update_own ON styles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY styles_delete_own ON styles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

### 5. palettes: Enable RLS and add policies

```sql
ALTER TABLE palettes ENABLE ROW LEVEL SECURITY;

CREATE POLICY palettes_select_own_or_public ON palettes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY palettes_insert_own ON palettes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY palettes_update_own ON palettes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY palettes_delete_own ON palettes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

### 6. faces: Enable RLS and add policies

```sql
ALTER TABLE faces ENABLE ROW LEVEL SECURITY;

CREATE POLICY faces_select_own ON faces
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY faces_insert_own ON faces
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY faces_update_own ON faces
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY faces_delete_own ON faces
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

### 7. favorites: Enable RLS and add policies

```sql
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY favorites_select_own ON favorites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY favorites_insert_own ON favorites
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY favorites_update_own ON favorites
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY favorites_delete_own ON favorites
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
```

### 8. Storage: thumbnails bucket (private, path = {user_id}/...)

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

### 9. Storage: faces bucket (private, path = {user_id}/...)

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

### 10. Storage: style-references bucket (private, path includes user_id)

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

### 11. Sync-analytics: Remove trust in body user_id when unauthenticated

No SQL; application change only (see Instructional Prompt below).

---

## Instructional Prompts for a Coding Agent

---

### Fix 1: profiles RLS

**Prompt:**

```
Add a new Supabase migration file in viewbait/supabase/migrations/ that enables RLS on the profiles table and creates policies so that authenticated users can only SELECT and UPDATE their own profile row (where id = auth.uid()). Do not add INSERT or DELETE policies for authenticated (profiles are created by auth trigger or service role). Use the exact policy names profiles_select_own and profiles_update_own. Include a short comment that is_admin must not be updatable by regular users (enforce in app or with a trigger if needed). Run the migration locally or document that it must be run in Supabase. Make the migration idempotent (DROP POLICY IF EXISTS before CREATE POLICY).
```

---

### Fix 2: thumbnails RLS

**Prompt:**

```
Add a new Supabase migration file in viewbait/supabase/migrations/ that enables RLS on the thumbnails table and creates policies: (1) SELECT for authenticated where user_id = auth.uid() OR is_public = true; (2) INSERT for authenticated WITH CHECK (user_id = auth.uid()); (3) UPDATE for authenticated USING and WITH CHECK (user_id = auth.uid()); (4) DELETE for authenticated USING (user_id = auth.uid()). Use policy names thumbnails_select_own_or_public, thumbnails_insert_own, thumbnails_update_own, thumbnails_delete_own. Ensure the migration is idempotent (DROP POLICY IF EXISTS before CREATE POLICY).
```

---

### Fix 3: user_subscriptions RLS

**Prompt:**

```
Add a new Supabase migration file in viewbait/supabase/migrations/ that enables RLS on the user_subscriptions table and creates a single policy: SELECT for authenticated USING (user_id = auth.uid()). Do not add INSERT, UPDATE, or DELETE policies for authenticated (only service role / RPC should write). Name the policy user_subscriptions_select_own. Make the migration idempotent.
```

---

### Fix 4: styles RLS

**Prompt:**

```
Add a new Supabase migration file in viewbait/supabase/migrations/ that enables RLS on the styles table and creates policies: SELECT for authenticated where user_id = auth.uid() OR is_public = true; INSERT/UPDATE/DELETE for authenticated only for own rows (user_id = auth.uid()). Use names styles_select_own_or_public, styles_insert_own, styles_update_own, styles_delete_own. Make the migration idempotent.
```

---

### Fix 5: palettes RLS

**Prompt:**

```
Add a new Supabase migration file in viewbait/supabase/migrations/ that enables RLS on the palettes table and creates policies: SELECT for authenticated where user_id = auth.uid() OR is_public = true; INSERT/UPDATE/DELETE for authenticated only for own rows (user_id = auth.uid()). Use names palettes_select_own_or_public, palettes_insert_own, palettes_update_own, palettes_delete_own. Make the migration idempotent.
```

---

### Fix 6: faces RLS

**Prompt:**

```
Add a new Supabase migration file in viewbait/supabase/migrations/ that enables RLS on the faces table and creates policies so that authenticated users can SELECT, INSERT, UPDATE, and DELETE only rows where user_id = auth.uid(). Use policy names faces_select_own, faces_insert_own, faces_update_own, faces_delete_own. Make the migration idempotent.
```

---

### Fix 7: favorites RLS

**Prompt:**

```
Add a new Supabase migration file in viewbait/supabase/migrations/ that enables RLS on the favorites table and creates policies so that authenticated users can SELECT, INSERT, UPDATE, and DELETE only rows where user_id = auth.uid(). Use policy names favorites_select_own, favorites_insert_own, favorites_update_own, favorites_delete_own. Make the migration idempotent.
```

---

### Fix 8: Storage policies for thumbnails, faces, style-references buckets

**Prompt:**

```
Add a new Supabase migration file (or document in a markdown file under supabase/migrations/ or docs/) that defines storage policies for the buckets thumbnails, faces, and style-references. The application uses the path convention {user_id}/... for these private buckets. Create policies on storage.objects so that authenticated users can SELECT, INSERT, UPDATE, and DELETE only objects where the first path segment equals auth.uid()::text. Use Supabase storage policy syntax: (storage.foldername(name))[1] = auth.uid()::text. If your project uses a different migration pattern for storage (e.g. dashboard-only), produce the SQL that would be run in the Supabase SQL editor and save it in a file under supabase/migrations/ with a descriptive name (e.g. 004_storage_rls_policies.sql).
```

---

### Fix 9: Remove body user_id fallback in sync-analytics

**Prompt:**

```
In viewbait/app/api/experiments/sync-analytics/route.ts, remove the fallback that uses body.user_id when the user is not authenticated. Require authentication: call requireAuth(supabase) (or equivalent from @/lib/server/utils/auth) at the start of the POST handler and use the returned user.id for all operations. Remove the SyncAnalyticsRequest property user_id if it is only used for that fallback. Do not allow unauthenticated callers or client-provided user_id to trigger sync for any user. Update any tests or docs that assumed unauthenticated or body-based user_id behavior.
```

---

## Verification steps

1. **Export current RLS state:** Run a query in the Supabase SQL Editor that lists all tables and their RLS status plus policy names (e.g. query `pg_policies` and `pg_tables` for `relrowsecurity`), and save the result (e.g. in `supabase/tables/rls-policies-export.csv` or in the repo) so future audits can diff.
2. **Test with two users:** For each user-owned table, log in as user A and verify that user A cannot read or write user B's rows (use Supabase client with anon key and user A's session).
3. **Storage:** For each private bucket, try to read/write an object under another user's path using an authenticated client; expect 403 or empty result.
4. **Service role:** Ensure that server-side code that must bypass RLS (notifications insert, credits RPC, webhooks) uses createServiceClient() only and never exposes it to the client.

---

*End of audit.*
