/**
 * Feedback Service
 * 
 * Handles feedback submission via secure API routes.
 * Supports both authenticated and anonymous submissions.
 */

import type { FeedbackCategory, FeedbackSeverity } from '@/lib/types/database'

export interface FeedbackSubmitData {
  category: FeedbackCategory
  message: string
  severity?: FeedbackSeverity
  email?: string
  name?: string
  source?: string
  page_url?: string
  app_version?: string
  device?: string
  user_agent?: string
  metadata?: Record<string, unknown>
  rating?: number
}

export interface FeedbackSubmitResponse {
  success: boolean
  feedbackId?: string
  error?: string
  message?: string
}

/**
 * Submit feedback
 * Works for both authenticated and anonymous users
 */
export async function submitFeedback(
  data: FeedbackSubmitData
): Promise<FeedbackSubmitResponse> {
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: result.error || 'Failed to submit feedback',
      }
    }

    return {
      success: true,
      feedbackId: result.feedbackId,
      message: result.message || 'Feedback submitted successfully',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}
