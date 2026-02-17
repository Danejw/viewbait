import type { YouTubeVideoAnalytics } from '@/lib/services/youtube-video-analyze'

export interface OptimizeYouTubeDescriptionParams {
  videoTitle: string
  analytics: YouTubeVideoAnalytics
  channelTitle?: string
  channelDescription?: string
  channelSocialLinks?: string[]
}

export async function optimizeYouTubeDescription(
  params: OptimizeYouTubeDescriptionParams
): Promise<{ description: string | null; error: Error | null }> {
  try {
    const response = await fetch('/api/youtube/videos/optimize-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        description: null,
        error: new Error(errorData.error || 'Failed to optimize YouTube description'),
      }
    }

    const data = await response.json()
    return {
      description: typeof data.description === 'string' ? data.description : null,
      error: null,
    }
  } catch (error) {
    return {
      description: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

export async function updateYouTubeVideoDescription(
  videoId: string,
  description: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const response = await fetch(`/api/youtube/videos/${encodeURIComponent(videoId)}/update-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: new Error(errorData.error || 'Failed to update YouTube description'),
      }
    }

    return { success: true, error: null }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}
