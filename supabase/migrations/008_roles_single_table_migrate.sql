-- ============================================================================
-- Migration: Convert from two-table (roles + user_roles) to single roles table
-- Run only if you previously applied 007 with the old two-table design.
-- ============================================================================

DO $$
BEGIN
  -- If user_roles exists, we have the old schema: migrate to single table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    -- Create new single roles table (different name to avoid conflict)
    CREATE TABLE IF NOT EXISTS roles_new (
      user_id uuid NOT NULL PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('member', 'admin')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    COMMENT ON TABLE roles_new IS 'User role assignments. No row means lowest tier (member).';

    -- Copy data: old roles (lookup) + user_roles -> roles_new (user_id, role name)
    INSERT INTO roles_new (user_id, role, created_at)
    SELECT ur.user_id, r.name, ur.created_at
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.name IN ('member', 'admin')
    ON CONFLICT (user_id) DO NOTHING;

    -- Drop old tables
    DROP TABLE IF EXISTS user_roles;
    DROP TABLE IF EXISTS roles;

    -- Rename new table to roles
    ALTER TABLE roles_new RENAME TO roles;

    CREATE INDEX IF NOT EXISTS idx_roles_role ON roles(role) WHERE role = 'admin';

    ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS roles_select_policy ON roles;
    CREATE POLICY roles_select_policy ON roles
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
