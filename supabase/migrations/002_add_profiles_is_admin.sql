-- ============================================================================
-- Migration: Add is_admin column to profiles table
-- Description: Adds admin flag to enable admin-only features like notification broadcast
-- ============================================================================

-- Add is_admin column with default false
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN profiles.is_admin IS 'Whether this user has admin privileges. Used for admin-only features like notification broadcast.';

-- Create index for admin lookups (rarely used but helpful for admin queries)
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin 
  ON profiles(is_admin) 
  WHERE is_admin = true;
