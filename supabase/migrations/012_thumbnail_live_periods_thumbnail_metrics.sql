-- ============================================================================
-- Migration: thumbnail_live_periods thumbnail-specific metrics
-- Description: Add YouTube Analytics thumbnail impressions and CTR per live period.
--              videoThumbnailImpressions = times thumbnail was shown;
--              videoThumbnailImpressionsClickRate = % of impressions that led to a click.
--              Safe to run even if 011 has not been applied (no-op when table missing).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'thumbnail_live_periods'
  ) THEN
    ALTER TABLE thumbnail_live_periods
      ADD COLUMN IF NOT EXISTS thumbnail_impressions integer NULL,
      ADD COLUMN IF NOT EXISTS thumbnail_ctr_percent numeric NULL;
    COMMENT ON COLUMN thumbnail_live_periods.thumbnail_impressions IS 'Number of times the video thumbnail was shown (YouTube Analytics videoThumbnailImpressions).';
    COMMENT ON COLUMN thumbnail_live_periods.thumbnail_ctr_percent IS 'Percentage of thumbnail impressions that led to a click (0-100).';
  END IF;
END $$;
