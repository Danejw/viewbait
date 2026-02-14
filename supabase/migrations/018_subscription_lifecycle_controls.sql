-- ============================================================================
-- Migration: Subscription lifecycle controls and single-subscription invariant
-- Description:
--   - Adds lifecycle metadata for pause/resume operations
--   - Enforces one user_subscriptions row per user (single-subscription invariant)
--   - Constrains status values to app-recognized lifecycle states
-- Reference: docs/database_security_principles.md
-- ============================================================================

ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS resumed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pause_collection_behavior text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'user_subscriptions_user_id_unique'
  ) THEN
    CREATE UNIQUE INDEX user_subscriptions_user_id_unique
      ON user_subscriptions (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_subscriptions_status_valid'
  ) THEN
    ALTER TABLE user_subscriptions
      ADD CONSTRAINT user_subscriptions_status_valid
      CHECK (
        status IN (
          'free',
          'active',
          'paused_until_period_end',
          'paused_free',
          'past_due_locked',
          'cancelled'
        )
      );
  END IF;
END $$;
