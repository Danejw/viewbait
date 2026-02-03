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
