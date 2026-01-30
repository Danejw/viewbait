/**
 * Server-side feedback submission.
 * Shared validation and insert logic for the feedback API route and the chat agent.
 */

import { createServiceClient } from '@/lib/supabase/service'

/** Allowed feedback categories (must match DB constraint). */
export const FEEDBACK_CATEGORIES = [
  'bug',
  'feature request',
  'other',
  'just a message',
] as const

export type FeedbackCategoryValue = (typeof FEEDBACK_CATEGORIES)[number]

/** ~800 words ≈ 5000 characters (avg 6 chars/word). */
export const MESSAGE_MAX_LENGTH = 5000

/** Basic email format (RFC 5322 simplified). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface SubmitFeedbackFromServerPayload {
  message: string
  category: string
  email?: string | null
  page_url: string
  app_version: string
  user_agent: string
}

function isFeedbackCategory(value: string): value is FeedbackCategoryValue {
  return FEEDBACK_CATEGORIES.includes(value as FeedbackCategoryValue)
}

/**
 * Validates payload, inserts a single row into the feedback table, and returns the new id.
 * Throws on validation failure or database error.
 */
export async function submitFeedbackFromServer(
  payload: SubmitFeedbackFromServerPayload
): Promise<{ id: string }> {
  const message = payload.message?.trim() ?? ''
  const category = payload.category?.trim() ?? ''
  const email =
    payload.email === undefined || payload.email === null
      ? null
      : typeof payload.email === 'string'
        ? payload.email.trim() || null
        : null
  const page_url = payload.page_url?.trim() ?? ''
  const app_version = payload.app_version?.trim() ?? ''
  const user_agent = payload.user_agent?.trim() ?? ''

  if (!message) {
    throw new Error('message is required')
  }
  if (message.length > MESSAGE_MAX_LENGTH) {
    throw new Error(
      `message must be at most ${MESSAGE_MAX_LENGTH} characters (approximately 800 words)`
    )
  }
  if (!category) {
    throw new Error('category is required')
  }
  if (!isFeedbackCategory(category)) {
    throw new Error(
      `category must be one of: ${FEEDBACK_CATEGORIES.join(', ')}`
    )
  }
  if (!page_url) {
    throw new Error('page_url is required')
  }
  if (!app_version) {
    throw new Error('app_version is required')
  }
  if (!user_agent) {
    throw new Error('user_agent is required')
  }
  if (email !== null && email !== '' && !EMAIL_REGEX.test(email)) {
    throw new Error('email must be a valid email address')
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('feedback')
    .insert({
      message,
      email,
      category,
      page_url,
      app_version,
      user_agent,
      metadata: {},
    })
    .select('id')
    .single()

  if (error) {
    throw error
  }
  if (!data?.id) {
    throw new Error('Failed to submit feedback: no ID returned')
  }

  return { id: data.id }
}
