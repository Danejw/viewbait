/**
 * Client-safe YouTube constants.
 * Used for scope checks on the client (e.g. gating "Use thumbnail for this video").
 * Server uses lib/services/youtube.ts YOUTUBE_THUMBNAIL_SCOPE; keep values identical.
 */

/**
 * Scope required for thumbnails.set per API doc:
 * https://developers.google.com/youtube/v3/docs/thumbnails/set
 * (Auth: at least one of youtube.force-ssl, youtube.upload, youtube, youtubepartner)
 */
export const YOUTUBE_THUMBNAIL_SCOPE =
  "https://www.googleapis.com/auth/youtube.force-ssl";

/** All YouTube scopes we request at sign-in/reconnect (for fallback when provider does not return granted scopes). Includes thumbnails.set auth scopes per API doc. */
export const YOUTUBE_SCOPES_REQUESTED = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  YOUTUBE_THUMBNAIL_SCOPE,
  "https://www.googleapis.com/auth/youtube.upload",
];
