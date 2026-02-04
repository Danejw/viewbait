-- ============================================================================
-- Migration: thumbnails.share_click_count + atomic increment RPC
-- Description: Adds approval score (click count) for shared gallery; RPC for
--              atomic increment so concurrent clicks are safe.
-- ============================================================================

ALTER TABLE thumbnails
  ADD COLUMN IF NOT EXISTS share_click_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN thumbnails.share_click_count IS 'Number of clicks on this thumbnail when viewed via a shared project gallery link.';

-- Atomic increment: single UPDATE so no race condition. Caller must validate
-- that (p_thumbnail_id, p_project_id) belongs to a shared project before calling.
CREATE OR REPLACE FUNCTION increment_thumbnail_share_click_count(
  p_thumbnail_id uuid,
  p_project_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE thumbnails
  SET share_click_count = share_click_count + 1
  WHERE id = p_thumbnail_id AND project_id = p_project_id;
$$;

COMMENT ON FUNCTION increment_thumbnail_share_click_count(uuid, uuid) IS 'Atomically increments share_click_count for a thumbnail in a project. Used by public share click API.';
