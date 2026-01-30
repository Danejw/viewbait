-- ============================================================================
-- Migration: Projects share_slug and share_mode
-- Description: Makes projects shareable via a public link. share_slug is the
--              URL segment; share_mode controls 'all' or 'favorites' thumbnails.
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS share_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS share_mode text;

COMMENT ON COLUMN projects.share_slug IS 'Unique slug for public share URL (e.g. /p/<slug>). NULL = not shared.';
COMMENT ON COLUMN projects.share_mode IS 'When shared: all = all project thumbnails, favorites = only liked thumbnails. NULL when not shared.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_share_slug ON projects(share_slug) WHERE share_slug IS NOT NULL;
