-- ============================================================================
-- Migration: Add onboarding_completed column to profiles table
-- Description: Flags whether the user has completed the onboarding flow.
--              Used to redirect first-time sign-ins to /onboarding.
-- ============================================================================

-- Add onboarding_completed column with default false
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether this user has completed the onboarding flow. When false, authenticated users visiting /studio are redirected to /onboarding.';
