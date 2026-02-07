/**
 * Client-side service for YouTube video analysis (Gemini video understanding).
 * Calls the Next.js API route that uses Gemini to analyze a video by URL.
 */

export interface YouTubeVideoAnalyticsCharacterScene {
  part: string
  description: string
}

export interface YouTubeVideoAnalyticsCharacter {
  name: string
  scenes: YouTubeVideoAnalyticsCharacterScene[]
}

export interface YouTubeVideoAnalyticsPlaceScene {
  part: string
  description: string
}

export interface YouTubeVideoAnalyticsPlace {
  name: string
  scenes: YouTubeVideoAnalyticsPlaceScene[]
}

export interface YouTubeVideoAnalytics {
  summary: string
  topic: string
  tone: string
  key_moments: string
  hooks: string
  duration_estimate: string
  thumbnail_appeal_notes: string
  content_type: string
  /** Main characters/people and the scenes where they appear (optional for backward compatibility with cached entries). */
  characters?: YouTubeVideoAnalyticsCharacter[]
  /** Places/locations the video goes through and scenes where each appears (optional for backward compatibility). */
  places?: YouTubeVideoAnalyticsPlace[]
}

export async function analyzeYouTubeVideo(
  videoId: string
): Promise<{ analytics: YouTubeVideoAnalytics | null; error: Error | null }> {
  try {
    const response = await fetch('/api/youtube/videos/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: videoId.trim() }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        analytics: null,
        error: new Error(errorData.error || 'Failed to analyze video'),
      }
    }

    const data = await response.json()
    return {
      analytics: data.analytics ?? null,
      error: null,
    }
  } catch (error) {
    return {
      analytics: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/** Thumbnail concept returned by suggest-thumbnail-concepts API. */
export interface ThumbnailConcept {
  text: string
  styleHint?: string
}

/**
 * Suggest 2–4 thumbnail concept prompts from video analytics.
 * Client must pass analytics (from cache or from a prior analyze call). Pro tier only.
 */
export async function suggestThumbnailConcepts(
  videoId: string,
  videoTitle: string,
  analytics: YouTubeVideoAnalytics
): Promise<{ concepts: ThumbnailConcept[] | null; error: Error | null }> {
  try {
    const response = await fetch('/api/youtube/videos/suggest-thumbnail-concepts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: videoId.trim(),
        videoTitle: videoTitle.trim(),
        analytics,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        concepts: null,
        error: new Error(errorData.error || 'Failed to suggest thumbnail concepts'),
      }
    }

    const data = await response.json()
    return {
      concepts: Array.isArray(data.concepts) ? data.concepts : null,
      error: null,
    }
  } catch (error) {
    return {
      concepts: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}
