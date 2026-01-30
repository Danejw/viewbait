-- ============================================================================
-- Migration: Create feedback table
-- Description: Secure feedback submissions. Insert-only from API (service role).
--              No SELECT/UPDATE/DELETE for anon or authenticated; only inserts
--              are performed server-side via the feedback API route.
-- ============================================================================

-- ============================================================================
-- 1. Create feedback table
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  status text NOT NULL DEFAULT 'New',
  category text NOT NULL,
  message text NOT NULL,
  page_url text,
  user_agent text,
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT feedback_status_check CHECK (
    status IN ('New', 'Pending', 'Triage', 'Resolved')
  ),
  CONSTRAINT feedback_category_check CHECK (
    category IN ('bug', 'feature request', 'other', 'message')
  )
);

COMMENT ON TABLE feedback IS 'User feedback submissions. Insert-only from API; no direct client access.';
COMMENT ON COLUMN feedback.status IS 'Workflow: New, Pending, Triage, Resolved.';
COMMENT ON COLUMN feedback.category IS 'Classification: bug, feature request, other, just a message.';
COMMENT ON COLUMN feedback.metadata IS 'Additional unstructured data; default empty object.';

-- ============================================================================
-- 2. Indexes for admin/triage queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);

-- ============================================================================
-- 3. Enable Row Level Security
-- ============================================================================
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS Policies: No direct access for anon or authenticated
-- ============================================================================
-- Inserts, updates, and reads are only allowed via service role (API route).
-- No policies for anon/authenticated = they cannot read or write directly.
-- The Next.js API route uses the service role client to insert one row per request.
