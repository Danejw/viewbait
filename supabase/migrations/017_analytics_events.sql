-- ============================================================================
-- Migration: analytics_events
-- Description: Event-level analytics for user behavior. Only the API (service
--              role) inserts; no RLS INSERT for app roles. Admin reads via
--              service role only. user_id NULL = anonymous; CASCADE on delete
--              for GDPR. Retention: consider cron to delete events older than
--              e.g. 24 months (see app/api/cron/cleanup-analytics-events).
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  page_path text NULL,
  properties jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE analytics_events IS 'User behavior events. Insert via API only (service role). Admin reads only. Retention: document 24 months; cron cleanup in app/api/cron/cleanup-analytics-events.';

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name_created_at ON analytics_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id_created_at ON analytics_events(session_id, created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- No SELECT/UPDATE/DELETE for authenticated or anon (admin uses service role).
-- No INSERT policy: only API route with service client writes.
-- So we do not create any policies; service client bypasses RLS.
