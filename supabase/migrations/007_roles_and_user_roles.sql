-- ============================================================================
-- Migration: roles table (single table)
-- Description: One table stores user role assignments. user_id + role.
--              No row = lowest tier (member). Enables role-based access
--              for admin dashboard and internal pages.
-- ============================================================================

-- ============================================================================
-- 1. roles table (user_id + role; one row per user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('member', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE roles IS 'User role assignments. No row means lowest tier (member).';
COMMENT ON COLUMN roles.role IS 'Role name: member (default), admin.';
CREATE INDEX IF NOT EXISTS idx_roles_role ON roles(role) WHERE role = 'admin';

-- ============================================================================
-- 2. RLS and backfill (only when this table has user_id = new single-table schema)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS roles_select_policy ON roles;
    CREATE POLICY roles_select_policy ON roles
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin'
    ) THEN
      INSERT INTO roles (user_id, role)
      SELECT p.id, 'admin'
      FROM profiles p
      WHERE p.is_admin = true
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;
END $$;
