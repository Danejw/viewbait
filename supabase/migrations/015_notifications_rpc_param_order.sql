-- ============================================================================
-- Migration: Fix get_notifications_with_counts for PostgREST schema cache
-- Description: Redefine RPC with parameters in alphabetical order so
--              PostgREST/schema cache finds the function when called with
--              named params (p_archived_only, p_limit, p_offset, p_unread_only).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_notifications_with_counts(
  p_archived_only boolean DEFAULT false,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_unread_only boolean DEFAULT false
)
RETURNS TABLE(notifications jsonb, count bigint, unread_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Unread count: always non-archived, unread for current user
  unread AS (
    SELECT count(*)::bigint AS n
    FROM notifications
    WHERE user_id = auth.uid()
      AND is_read = false
      AND is_archived = false
  ),
  -- Filtered list (same filters as list API)
  filtered AS (
    SELECT n.*
    FROM notifications n
    WHERE n.user_id = auth.uid()
      AND (NOT p_unread_only OR n.is_read = false)
      AND (
        (p_archived_only AND n.is_archived = true)
        OR (NOT p_archived_only AND n.is_archived = false)
      )
  ),
  paginated AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    coalesce(
      (SELECT jsonb_agg(row_to_json(paginated.*)::jsonb) FROM paginated),
      '[]'::jsonb
    ),
    (SELECT count(*)::bigint FROM filtered),
    (SELECT unread.n FROM unread);
END;
$$;

COMMENT ON FUNCTION get_notifications_with_counts(boolean, int, int, boolean) IS
  'Returns notifications list (paginated), total count for the filter, and unread count in one round-trip. Uses auth.uid() for current user. Parameter order matches PostgREST schema cache (alphabetical by name).';
