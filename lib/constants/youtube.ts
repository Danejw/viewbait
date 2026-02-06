/**
 * Client-safe YouTube constants.
 * Used for scope checks on the client (e.g. gating "Use thumbnail for this video").
 * Server uses lib/services/youtube.ts YOUTUBE_THUMBNAIL_SCOPE; keep values identical.
 */

/** Scope required for setting video thumbnails via YouTube Data API (thumbnails.set). */
export const YOUTUBE_THUMBNAIL_SCOPE =
  "https://www.googleapis.com/auth/youtube.force-ssl";
