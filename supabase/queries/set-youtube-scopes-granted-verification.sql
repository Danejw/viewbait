-- =============================================================================
-- One-off: Set scopes_granted for YouTube integrations (Option C verification)
-- =============================================================================
-- Use this in Supabase Dashboard → SQL Editor to confirm that empty
-- scopes_granted was the cause of "Thumbnail upload requires extra permission".
-- After running, try "Set thumbnail" again in the app.
--
-- Scopes must include at least one of the thumbnails.set auth scopes per API doc:
-- https://developers.google.com/youtube/v3/docs/thumbnails/set
-- (youtube.force-ssl, youtube.upload, youtube, or youtubepartner)
-- We store youtube.force-ssl and youtube.upload to match app request and doc.
--
-- Run ONE of the blocks below.
-- =============================================================================

-- Option 1: Update ALL connected integrations that have empty scopes_granted
-- (safest for verification: only touches rows that are connected but missing scopes)
UPDATE youtube_integrations
SET
  scopes_granted = ARRAY[
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/youtube.upload'
  ],
  updated_at = now()
WHERE is_connected = true
  AND (
    scopes_granted IS NULL
    OR array_length(scopes_granted, 1) IS NULL
    OR array_length(scopes_granted, 1) = 0
  );

-- Option 2: Update only a specific user (replace the UUID with your auth.users id)
-- SELECT id FROM auth.users WHERE email = 'your@email.com';  -- get user_id
-- UPDATE youtube_integrations
-- SET
--   scopes_granted = ARRAY[
--     'https://www.googleapis.com/auth/youtube.readonly',
--     'https://www.googleapis.com/auth/yt-analytics.readonly',
--     'https://www.googleapis.com/auth/youtube.force-ssl',
--     'https://www.googleapis.com/auth/youtube.upload'
--   ],
--   updated_at = now()
-- WHERE user_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
--   AND is_connected = true;
