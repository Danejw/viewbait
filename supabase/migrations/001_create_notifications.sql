-- ============================================================================
-- Migration: Create Notifications System
-- Description: Creates notifications table with RLS policies and RPC functions
-- ============================================================================

-- ============================================================================
-- 1. Create notifications table
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  icon text,
  action_url text,
  action_label text,
  metadata jsonb NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  CONSTRAINT notifications_severity_check CHECK (severity IN ('info', 'success', 'warning', 'error')),
  CONSTRAINT notifications_type_check CHECK (type IN ('system', 'billing', 'reward', 'social', 'info', 'warning'))
);

-- Add comment for documentation
COMMENT ON TABLE notifications IS 'In-app notifications for users. Only service role can insert.';

-- ============================================================================
-- 2. Create indexes for efficient queries
-- ============================================================================

-- Index for listing notifications by user (ordered by created_at DESC)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON notifications(user_id, created_at DESC);

-- Partial index for unread notifications (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, is_read, created_at DESC) 
  WHERE is_read = false;

-- Partial index for active (non-archived) notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_active 
  ON notifications(user_id, is_archived, created_at DESC) 
  WHERE is_archived = false;

-- ============================================================================
-- 3. Create updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notifications_updated_at ON notifications;
CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- ============================================================================
-- 4. Enable Row Level Security
-- ============================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. Create RLS Policies
-- ============================================================================

-- SELECT: Users can read their own notifications
DROP POLICY IF EXISTS notifications_select_policy ON notifications;
CREATE POLICY notifications_select_policy ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- UPDATE: Users can update their own notifications (via RPCs)
DROP POLICY IF EXISTS notifications_update_policy ON notifications;
CREATE POLICY notifications_update_policy ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT: No policy for authenticated role = only service role can insert
-- This is intentional - notifications should only be created server-side

-- DELETE: Users can delete their own notifications (optional cleanup)
DROP POLICY IF EXISTS notifications_delete_policy ON notifications;
CREATE POLICY notifications_delete_policy ON notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- 6. Create RPC Functions
-- ============================================================================

-- Mark a single notification as read
-- Returns the updated notification or NULL if not found/already read
CREATE OR REPLACE FUNCTION rpc_mark_notification_read(notification_id uuid)
RETURNS notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  result notifications;
BEGIN
  UPDATE notifications 
  SET 
    is_read = true, 
    read_at = now(), 
    updated_at = now()
  WHERE 
    id = notification_id 
    AND user_id = auth.uid() 
    AND is_read = false
  RETURNING * INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION rpc_mark_notification_read(uuid) IS 
  'Marks a notification as read. Only works for the authenticated user''s own notifications.';

-- Archive a notification (soft delete)
-- Returns the updated notification or NULL if not found/already archived
CREATE OR REPLACE FUNCTION rpc_archive_notification(notification_id uuid)
RETURNS notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  result notifications;
BEGIN
  UPDATE notifications 
  SET 
    is_archived = true, 
    archived_at = now(), 
    updated_at = now()
  WHERE 
    id = notification_id 
    AND user_id = auth.uid() 
    AND is_archived = false
  RETURNING * INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION rpc_archive_notification(uuid) IS 
  'Archives a notification. Only works for the authenticated user''s own notifications.';

-- Mark all unread notifications as read
-- Returns the count of updated notifications
CREATE OR REPLACE FUNCTION rpc_mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  updated_count integer;
BEGIN
  UPDATE notifications 
  SET 
    is_read = true, 
    read_at = now(), 
    updated_at = now()
  WHERE 
    user_id = auth.uid() 
    AND is_read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION rpc_mark_all_notifications_read() IS 
  'Marks all unread notifications as read for the authenticated user. Returns count of updated rows.';

-- ============================================================================
-- 7. Enable Realtime (run in Supabase Dashboard or via API)
-- ============================================================================
-- Note: This needs to be done in Supabase Dashboard:
-- Database > Replication > Enable for 'notifications' table
-- 
-- Or via SQL (may require superuser privileges):
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
