-- ============================================================================
-- Migration: thumbnail_live_periods
-- Description: Tracks when a ViewBait thumbnail was "live" on a YouTube video.
--              One row per promotion; ended_at = null means still live.
--              Unique: only one active (ended_at IS NULL) per (user_id, video_id).
-- ============================================================================

CREATE TABLE IF NOT EXISTS thumbnail_live_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thumbnail_id uuid NOT NULL REFERENCES thumbnails(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  video_title text NULL,
  views integer NULL,
  watch_time_minutes numeric NULL,
  average_view_duration_seconds numeric NULL,
  impressions integer NULL,
  impressions_ctr_percent numeric NULL,
  metrics_fetched_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE thumbnail_live_periods IS 'One continuous span per (user, video) where a ViewBait thumbnail was live; ended_at null = still live.';
COMMENT ON COLUMN thumbnail_live_periods.ended_at IS 'When we set another thumbnail on the same video from ViewBait; null = still live.';
COMMENT ON COLUMN thumbnail_live_periods.impressions_ctr_percent IS 'Click-through rate for impressions (0-100).';

-- Only one active (still live) period per (user_id, video_id)
CREATE UNIQUE INDEX idx_thumbnail_live_periods_active_unique
  ON thumbnail_live_periods (user_id, video_id)
  WHERE ended_at IS NULL;

CREATE INDEX idx_thumbnail_live_periods_user_thumbnail ON thumbnail_live_periods (user_id, thumbnail_id);
CREATE INDEX idx_thumbnail_live_periods_user_video ON thumbnail_live_periods (user_id, video_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_thumbnail_live_periods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS thumbnail_live_periods_updated_at ON thumbnail_live_periods;
CREATE TRIGGER thumbnail_live_periods_updated_at
  BEFORE UPDATE ON thumbnail_live_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_thumbnail_live_periods_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE thumbnail_live_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS thumbnail_live_periods_select_policy ON thumbnail_live_periods;
CREATE POLICY thumbnail_live_periods_select_policy ON thumbnail_live_periods
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS thumbnail_live_periods_insert_policy ON thumbnail_live_periods;
CREATE POLICY thumbnail_live_periods_insert_policy ON thumbnail_live_periods
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS thumbnail_live_periods_update_policy ON thumbnail_live_periods;
CREATE POLICY thumbnail_live_periods_update_policy ON thumbnail_live_periods
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No DELETE policy: periods are historical; only service/route inserts/updates.
