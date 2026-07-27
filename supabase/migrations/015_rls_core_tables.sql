-- ============================================================================
-- Migration: RLS for core user-scoped tables
-- Description: Enables RLS and adds policies so authenticated users can only
--              access rows where user_id = auth.uid(). Repo as source of truth.
-- Reference: docs/database_security_principles.md
-- ============================================================================

-- Helper: run policy block only if table exists (avoids failing when table created elsewhere)
-- We apply to: profiles, thumbnails, styles, palettes, faces, favorites,
--              experiments, user_subscriptions, analytics_snapshots

-- ============================================================================
-- 1. profiles (owned by id = auth.uid(); restrict is_admin changes)
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_policy ON profiles;
CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_policy ON profiles;
CREATE POLICY profiles_insert_policy ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update own row but cannot grant themselves is_admin (only service role / dashboard should set is_admin)
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
CREATE POLICY profiles_update_policy ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (is_admin = (SELECT is_admin FROM profiles p WHERE p.id = auth.uid()))
  );

-- No DELETE for profiles (or add if soft-delete desired)

-- ============================================================================
-- 2. thumbnails
-- ============================================================================
ALTER TABLE thumbnails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS thumbnails_select_policy ON thumbnails;
CREATE POLICY thumbnails_select_policy ON thumbnails
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS thumbnails_insert_policy ON thumbnails;
CREATE POLICY thumbnails_insert_policy ON thumbnails
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS thumbnails_update_policy ON thumbnails;
CREATE POLICY thumbnails_update_policy ON thumbnails
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS thumbnails_delete_policy ON thumbnails;
CREATE POLICY thumbnails_delete_policy ON thumbnails
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. styles
-- ============================================================================
ALTER TABLE styles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS styles_select_policy ON styles;
CREATE POLICY styles_select_policy ON styles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS styles_insert_policy ON styles;
CREATE POLICY styles_insert_policy ON styles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS styles_update_policy ON styles;
CREATE POLICY styles_update_policy ON styles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS styles_delete_policy ON styles;
CREATE POLICY styles_delete_policy ON styles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 4. palettes
-- ============================================================================
ALTER TABLE palettes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS palettes_select_policy ON palettes;
CREATE POLICY palettes_select_policy ON palettes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS palettes_insert_policy ON palettes;
CREATE POLICY palettes_insert_policy ON palettes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS palettes_update_policy ON palettes;
CREATE POLICY palettes_update_policy ON palettes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS palettes_delete_policy ON palettes;
CREATE POLICY palettes_delete_policy ON palettes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 5. faces
-- ============================================================================
ALTER TABLE faces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS faces_select_policy ON faces;
CREATE POLICY faces_select_policy ON faces
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS faces_insert_policy ON faces;
CREATE POLICY faces_insert_policy ON faces
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS faces_update_policy ON faces;
CREATE POLICY faces_update_policy ON faces
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS faces_delete_policy ON faces;
CREATE POLICY faces_delete_policy ON faces
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 6. favorites
-- ============================================================================
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_select_policy ON favorites;
CREATE POLICY favorites_select_policy ON favorites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS favorites_insert_policy ON favorites;
CREATE POLICY favorites_insert_policy ON favorites
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS favorites_update_policy ON favorites;
CREATE POLICY favorites_update_policy ON favorites
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS favorites_delete_policy ON favorites;
CREATE POLICY favorites_delete_policy ON favorites
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 7. experiments
-- ============================================================================
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS experiments_select_policy ON experiments;
CREATE POLICY experiments_select_policy ON experiments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS experiments_insert_policy ON experiments;
CREATE POLICY experiments_insert_policy ON experiments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS experiments_update_policy ON experiments;
CREATE POLICY experiments_update_policy ON experiments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS experiments_delete_policy ON experiments;
CREATE POLICY experiments_delete_policy ON experiments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 8. user_subscriptions (one row per user; user_id = auth.uid())
-- ============================================================================
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_subscriptions_select_policy ON user_subscriptions;
CREATE POLICY user_subscriptions_select_policy ON user_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE typically done by service role (Stripe webhook, checkout). No policy = only service role.

-- ============================================================================
-- 9. analytics_snapshots (written by service/sync; read by user via experiments)
-- ============================================================================
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow SELECT only for users who own an experiment that references this video_id.
-- Simplification: allow SELECT where video_id is in user's experiments (join via experiments table).
DROP POLICY IF EXISTS analytics_snapshots_select_policy ON analytics_snapshots;
CREATE POLICY analytics_snapshots_select_policy ON analytics_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM experiments e
      WHERE e.video_id = analytics_snapshots.video_id
        AND e.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE only via service role (sync-analytics route uses service client).
