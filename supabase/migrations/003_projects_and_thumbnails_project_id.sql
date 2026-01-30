-- ============================================================================
-- Migration: Projects table + thumbnails.project_id
-- Description: Adds project-based workflow; projects store default_settings (JSONB).
--              Thumbnails get optional project_id. No backfill.
-- ============================================================================

-- ============================================================================
-- 1. Create projects table
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  default_settings jsonb
);

COMMENT ON TABLE projects IS 'User projects for organizing thumbnails; default_settings stores manual generator settings (JSONB).';
COMMENT ON COLUMN projects.default_settings IS 'Optional JSONB: thumbnailText, customInstructions, selectedStyle, selectedPalette, selectedAspectRatio, selectedResolution, variations, styleReferences, selectedFaces, faceExpression, facePose, etc.';

CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- ============================================================================
-- 2. Enable RLS on projects
-- ============================================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select_policy ON projects;
CREATE POLICY projects_select_policy ON projects
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS projects_insert_policy ON projects;
CREATE POLICY projects_insert_policy ON projects
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS projects_update_policy ON projects;
CREATE POLICY projects_update_policy ON projects
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS projects_delete_policy ON projects;
CREATE POLICY projects_delete_policy ON projects
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. Add project_id to thumbnails
-- ============================================================================
ALTER TABLE thumbnails
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN thumbnails.project_id IS 'Optional: links thumbnail to a project. NULL = no project (All thumbnails).';

CREATE INDEX IF NOT EXISTS idx_thumbnails_project_id ON thumbnails(project_id) WHERE project_id IS NOT NULL;
