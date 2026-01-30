/**
 * Feedback API Route
 *
 * Secure POST-only endpoint for feedback submissions.
 * Validates input via shared server helper, inserts a single row, and returns success or error.
 */

import { submitFeedbackFromServer } from '@/lib/server/feedback'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

export interface FeedbackRequestBody {
  message: string
  email?: string
  category: string
  page_url: string
  app_version: string
  user_agent: string
}

/**
 * POST /api/feedback
 * Submit feedback. Insert-only; no other operations.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    if (!body || typeof body !== 'object') {
      return validationErrorResponse('Request body must be a JSON object')
    }

    const message =
      typeof body.message === 'string' ? body.message.trim() : undefined
    const email =
      body.email === undefined || body.email === null
        ? undefined
        : typeof body.email === 'string'
          ? body.email.trim() || undefined
          : undefined
    const category =
      typeof body.category === 'string' ? body.category.trim() : undefined
    const pageUrl =
      typeof body.page_url === 'string' ? body.page_url.trim() : undefined
    const appVersion =
      typeof body.app_version === 'string' ? body.app_version.trim() : undefined
    const userAgentBody =
      typeof body.user_agent === 'string' ? body.user_agent.trim() : undefined
    const userAgentHeader = request.headers.get('user-agent') ?? undefined
    const user_agent = userAgentBody ?? userAgentHeader ?? ''

    if (!message) {
      return validationErrorResponse('message is required')
    }
    if (!category) {
      return validationErrorResponse('category is required')
    }
    if (!pageUrl) {
      return validationErrorResponse('page_url is required')
    }
    if (!appVersion) {
      return validationErrorResponse('app_version is required')
    }
    if (!user_agent) {
      return validationErrorResponse(
        'user_agent is required (send in body or via User-Agent header)'
      )
    }

    const { id } = await submitFeedbackFromServer({
      message,
      category,
      email: email ?? null,
      page_url: pageUrl,
      app_version: appVersion,
      user_agent,
    })

    return NextResponse.json(
      {
        success: true,
        id,
        message: 'Feedback submitted successfully',
      },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof SyntaxError || (err as { type?: string })?.type === 'entity.parse.failed') {
      return validationErrorResponse('Invalid request body: must be valid JSON')
    }
    if (err instanceof Error && err.message.includes('category must be')) {
      return validationErrorResponse(err.message)
    }
    if (err instanceof Error && (err.message.includes('message must be') || err.message.includes('email must be'))) {
      return validationErrorResponse(err.message)
    }
    logError(err, {
      route: 'POST /api/feedback',
      operation: 'feedback-route',
    })
    return databaseErrorResponse('Failed to submit feedback')
  }
}

/**
 * Reject any non-POST method.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    { status: 405 }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    { status: 405 }
  )
}
