-- ============================================================================
-- Migration: Drop notification RPCs
-- Description: Removes notification RPCs; list and mutations are now handled
--              by GET /api/notifications and route handlers with RLS-safe
--              table queries. Reduces attack surface and avoids PostgREST
--              schema cache signature issues.
-- ============================================================================

DROP FUNCTION IF EXISTS get_notifications_with_counts(int, int, boolean, boolean);
DROP FUNCTION IF EXISTS rpc_mark_all_notifications_read();
DROP FUNCTION IF EXISTS rpc_mark_notification_read(uuid);
DROP FUNCTION IF EXISTS rpc_archive_notification(uuid);

-- Refresh PostgREST schema cache so the API no longer exposes these functions.
NOTIFY pgrst, 'reload schema';
