-- ============================================================================
-- Migration: thumbnails.comments + updated_at + RLS for comment access
-- Description: Comments stored as JSONB array; updated_at for CAS. Only owner
--              or project editors can UPDATE (for commenting).
-- ============================================================================

-- 1. Add comments column (array of { user_id, comment, created_at })
ALTER TABLE thumbnails
  ADD COLUMN IF NOT EXISTS comments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN thumbnails.comments IS 'Array of { user_id (uuid), comment (text), created_at (ISO string) }. Only owner/editors can update via RLS.';

-- 2. Add updated_at for compare-and-swap concurrency control
ALTER TABLE thumbnails
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN thumbnails.updated_at IS 'Set on update; used for optimistic CAS when appending comments.';

-- Backfill existing rows so updated_at is set (for CAS)
UPDATE thumbnails
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Ensure NOT NULL after backfill (new rows get default from now())
ALTER TABLE thumbnails
  ALTER COLUMN updated_at SET DEFAULT now();

-- 3. Thumbnails UPDATE policy: owner OR project editor can update (for comments)
DROP POLICY IF EXISTS thumbnails_update_policy ON thumbnails;
CREATE POLICY thumbnails_update_policy ON thumbnails
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND project_id IN (SELECT project_id FROM project_editors WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      project_id IS NOT NULL
      AND project_id IN (SELECT project_id FROM project_editors WHERE user_id = auth.uid())
    )
  );
