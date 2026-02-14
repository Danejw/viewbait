-- ============================================================================
-- Migration: Add comments column to thumbnails table
-- Description: Adds a JSONB comments column to store user comments on thumbnails
--              in shared galleries. Comments are stored as an array of JSON objects
--              with user_id, comment text, and timestamp.
-- ============================================================================

-- Add comments column (JSONB array of comment objects)
ALTER TABLE thumbnails
  ADD COLUMN IF NOT EXISTS comments jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN thumbnails.comments IS 'JSONB array of comment objects. Each comment has: user_id (uuid), comment (text), created_at (timestamptz). Example: [{"user_id": "uuid", "comment": "I like this because...", "created_at": "2026-02-14T..."}]';

-- Create index for querying comments (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_thumbnails_comments ON thumbnails USING GIN (comments);

-- RPC function to add a comment to a thumbnail
-- Validates that the thumbnail belongs to the project before adding comment
CREATE OR REPLACE FUNCTION add_thumbnail_comment(
  p_thumbnail_id uuid,
  p_project_id uuid,
  p_comment_text text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comments jsonb;
  v_new_comment jsonb;
BEGIN
  -- Validate that thumbnail belongs to project
  IF NOT EXISTS (
    SELECT 1 FROM thumbnails
    WHERE id = p_thumbnail_id AND project_id = p_project_id
  ) THEN
    RAISE EXCEPTION 'Thumbnail not found or not in this project';
  END IF;

  -- Get current comments array
  SELECT COALESCE(comments, '[]'::jsonb) INTO v_comments
  FROM thumbnails
  WHERE id = p_thumbnail_id;

  -- Create new comment object
  v_new_comment := jsonb_build_object(
    'user_id', CASE WHEN p_user_id IS NOT NULL THEN p_user_id::text ELSE NULL END,
    'comment', p_comment_text,
    'created_at', to_jsonb(now()::text)
  );

  -- Append new comment to array
  v_comments := v_comments || jsonb_build_array(v_new_comment);

  -- Update thumbnail with new comments array
  UPDATE thumbnails
  SET comments = v_comments
  WHERE id = p_thumbnail_id;

  RETURN v_comments;
END;
$$;

COMMENT ON FUNCTION add_thumbnail_comment(uuid, uuid, text, uuid) IS 'Adds a comment to a thumbnail in a shared project. Validates thumbnail belongs to project. Returns updated comments array.';
