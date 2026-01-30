/**
 * Feedback Service
 *
 * Handles feedback submission via the secure POST-only API route.
 * Supports both authenticated and anonymous submissions.
 * Caller must provide page_url, app_version, and user_agent (or rely on browser User-Agent).
 */

import type { FeedbackTableCategory } from '@/lib/types/database'

export interface FeedbackSubmitData {
  /** Feedback category (required). */
  category: FeedbackTableCategory
  /** Feedback message (required, max ~800 words). */
  message: string
  /** User email (optional; for logged-in or follow-up). */
  email?: string
  /** URL where feedback was submitted (required). */
  page_url: string
  /** Application version (required). */
  app_version: string
  /** Browser/device info (required; can be omitted and sent via User-Agent header). */
  user_agent?: string
}

export interface FeedbackSubmitResponse {
  success: boolean
  /** Returned feedback row id (when success). */
  id?: string
  /** Alias for id for backward compatibility. */
  feedbackId?: string
  error?: string
  message?: string
}

/**
 * Submit feedback.
 * Works for both authenticated and anonymous users.
 * Requires: category, message, page_url, app_version; user_agent from body or browser.
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
      body: JSON.stringify({
        category: data.category,
        message: data.message,
        email: data.email,
        page_url: data.page_url,
        app_version: data.app_version,
        user_agent: data.user_agent,
      }),
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
      id: result.id,
      feedbackId: result.id,
      message: result.message || 'Feedback submitted successfully',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}
