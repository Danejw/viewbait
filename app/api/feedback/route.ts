/**
 * Feedback API Route
 * 
 * Handles POST (submit) operations for feedback.
 * Supports both authenticated and anonymous submissions.
 * All operations are server-side only for security.
 */

import { createClient } from '@/lib/supabase/server'
import { getOptionalAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { FeedbackCategory, FeedbackSeverity } from '@/lib/types/database'

export interface FeedbackSubmitRequest {
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
  metadata?: Record<string, any>
  rating?: number
}

/**
 * POST /api/feedback
 * Submit feedback (authenticated or anonymous)
 */
export async function POST(request: Request) {
  let user: { id: string } | null = null
  
  try {
    const supabase = await createClient()
    
    // Get optional authentication (supports both authenticated and anonymous)
    const authUser = await getOptionalAuth(supabase)
    user = authUser

    // Parse request body
    const body: FeedbackSubmitRequest = await request.json()
    
    // Validate required fields
    if (!body.category) {
      return validationErrorResponse('Category is required')
    }

    if (!body.message || !body.message.trim()) {
      return validationErrorResponse('Message is required')
    }

    // For anonymous users, email is required
    if (!authUser && (!body.email || !body.email.trim())) {
      return validationErrorResponse('Email is required for anonymous submissions')
    }

    // Collect context from request headers
    const userAgent = request.headers.get('user-agent') || null
    const pageUrl = body.page_url || null

    // Call RPC function to submit feedback
    // The RPC function handles all validation, rate limiting, and security
    const { data: feedbackId, error: rpcError } = await supabase.rpc(
      'rpc_submit_feedback',
      {
        p_category: body.category,
        p_message: body.message.trim(),
        p_severity: body.severity || 'normal',
        p_email: body.email?.trim() || null,
        p_name: body.name?.trim() || null,
        p_source: body.source || (authUser ? 'in_app' : 'website'),
        p_page_url: pageUrl,
        p_app_version: body.app_version || null,
        p_device: body.device || null,
        p_user_agent: userAgent,
        p_metadata: body.metadata || {},
        p_rating: body.rating || null,
      }
    )

    if (rpcError) {
      // RPC function returns user-friendly error messages
      logError(rpcError, {
        route: 'POST /api/feedback',
        userId: authUser?.id,
        operation: 'submit-feedback-rpc',
      })
      
      // Check if it's a validation error (starts with specific error messages)
      const errorMessage = rpcError.message || 'Failed to submit feedback'
      if (
        errorMessage.includes('Invalid category') ||
        errorMessage.includes('Invalid severity') ||
        errorMessage.includes('Message must be') ||
        errorMessage.includes('Email is required') ||
        errorMessage.includes('Invalid email format') ||
        errorMessage.includes('Rating must be') ||
        errorMessage.includes('Rate limit exceeded')
      ) {
        return validationErrorResponse(errorMessage)
      }
      
      return databaseErrorResponse('Failed to submit feedback')
    }

    if (!feedbackId) {
      return databaseErrorResponse('Failed to submit feedback: no ID returned')
    }

    return NextResponse.json(
      { 
        success: true,
        feedbackId,
        message: 'Feedback submitted successfully'
      },
      { status: 201 }
    )
  } catch (error) {
    // Handle JSON parsing errors
    if (error instanceof SyntaxError || (error as any).type === 'entity.parse.failed') {
      return validationErrorResponse('Invalid request body')
    }
    
    logError(error, {
      route: 'POST /api/feedback',
      userId: user?.id,
      operation: 'submit-feedback-route',
    })
    
    return serverErrorResponse(error, 'Failed to submit feedback')
  }
}
