-- ============================================================================
-- Migration: project_editors table + projects.editor_slug + RLS for shared editing
-- Description: Editor link feature – owners can share a link that adds signed-in
--              users as editors. Editors see the project and can add thumbnails.
-- ============================================================================

-- 1. Add editor_slug to projects (unique, URL-safe; used for /e/[slug] join link)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS editor_slug text;

COMMENT ON COLUMN projects.editor_slug IS 'Unique slug for editor join URL (/e/<slug>). NULL = editor link disabled.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_editor_slug ON projects(editor_slug) WHERE editor_slug IS NOT NULL;

-- 2. project_editors: who can edit (add thumbnails to) a project they don't own
CREATE TABLE IF NOT EXISTS project_editors (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

COMMENT ON TABLE project_editors IS 'Users who can add thumbnails to a project (joined via editor link). Owner is not stored here.';

CREATE INDEX IF NOT EXISTS idx_project_editors_user_id ON project_editors(user_id);

-- 3. Projects RLS: SELECT if owner OR in project_editors; INSERT/UPDATE/DELETE owner-only
DROP POLICY IF EXISTS projects_select_policy ON projects;
CREATE POLICY projects_select_policy ON projects
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR id IN (SELECT project_id FROM project_editors WHERE user_id = auth.uid())
  );

-- INSERT/UPDATE/DELETE unchanged (owner-only)
-- projects_insert_policy, projects_update_policy, projects_delete_policy already enforce user_id = auth.uid()

-- 4. Thumbnails RLS: SELECT if owner OR (project_id in a project user can edit)
DROP POLICY IF EXISTS thumbnails_select_policy ON thumbnails;
CREATE POLICY thumbnails_select_policy ON thumbnails
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND project_id IN (SELECT project_id FROM project_editors WHERE user_id = auth.uid())
    )
  );

-- INSERT/UPDATE/DELETE: keep existing (user_id = auth.uid()); editors add thumbnails as themselves

-- 5. project_editors RLS: users can only insert themselves (for join flow); no SELECT/UPDATE/DELETE for anon
ALTER TABLE project_editors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_editors_insert_policy ON project_editors;
CREATE POLICY project_editors_insert_policy ON project_editors
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow SELECT so users can see which projects they edit (used by list projects)
DROP POLICY IF EXISTS project_editors_select_policy ON project_editors;
CREATE POLICY project_editors_select_policy ON project_editors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
