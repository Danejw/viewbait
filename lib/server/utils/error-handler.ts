/**
 * Error Handler Utility
 * 
 * Standardized error responses for API routes.
 * Ensures consistent error format across all endpoints.
 */

import { NextResponse } from 'next/server'
import { sanitizeErrorForClient } from '@/lib/utils/error-sanitizer'
import { logError } from './logger'

export interface ErrorResponse {
  error: string
  code: string
  [key: string]: unknown
}

/**
 * Unauthorized response (401)
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'UNAUTHORIZED' },
    { status: 401 }
  )
}

/**
 * Not found response (404)
 */
export function notFoundResponse(message: string = 'Resource not found'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'NOT_FOUND' },
    { status: 404 }
  )
}

/**
 * Validation error response (400)
 */
export function validationErrorResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: message, code: 'VALIDATION_ERROR' },
    { status: 400 }
  )
}

/**
 * Forbidden response (403)
 */
export function forbiddenResponse(message: string, details?: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    { error: message, code: 'FORBIDDEN', ...details },
    { status: 403 }
  )
}

/**
 * Server error response (500)
 */
export function serverErrorResponse(
  error: unknown,
  message: string = 'Internal server error',
  context: { route?: string; userId?: string } = {}
): NextResponse {
  // Sanitize error message to prevent PII leakage
  const errorMessage = sanitizeErrorForClient(error, 'server-error', message)
  
  // Log error with PII redaction
  logError(error, {
    route: context.route || 'unknown-route',
    userId: context.userId,
    operation: 'server-error-response',
  })

  return NextResponse.json(
    { 
      error: errorMessage,
      code: 'INTERNAL_ERROR'
    },
    { status: 500 }
  )
}

/**
 * Database error response (500)
 */
export function databaseErrorResponse(message: string = 'Database operation failed'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'DATABASE_ERROR' },
    { status: 500 }
  )
}

/**
 * Configuration error response (500)
 */
export function configErrorResponse(message: string = 'Service not configured'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'CONFIG_ERROR' },
    { status: 500 }
  )
}

/**
 * Insufficient credits response (403)
 */
export function insufficientCreditsResponse(
  creditsRemaining: number,
  required: number
): NextResponse {
  return NextResponse.json(
    {
      error: 'Insufficient credits',
      code: 'INSUFFICIENT_CREDITS',
      creditsRemaining,
      required,
    },
    { status: 403 }
  )
}

/**
 * Tier limit response (403)
 */
export function tierLimitResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: message, code: 'TIER_LIMIT' },
    { status: 403 }
  )
}

/**
 * Subscription error response (500)
 */
export function subscriptionErrorResponse(message: string = 'Subscription operation failed'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'SUBSCRIPTION_ERROR' },
    { status: 500 }
  )
}

/**
 * Storage error response (500)
 */
export function storageErrorResponse(
  error: unknown,
  message: string = 'Storage operation failed',
  context: { route?: string; userId?: string } = {}
): NextResponse {
  const errorMessage = sanitizeErrorForClient(error, 'storage-error', message)
  
  logError(error, {
    route: context.route || 'unknown-route',
    userId: context.userId,
    operation: 'storage-error',
  })

  return NextResponse.json(
    { error: errorMessage, code: 'STORAGE_ERROR' },
    { status: 500 }
  )
}

/**
 * AI service error response (500)
 */
export function aiServiceErrorResponse(
  error: unknown,
  message: string = 'AI service error',
  context: { route?: string; userId?: string } = {}
): NextResponse {
  const errorMessage = sanitizeErrorForClient(error, 'ai-service-error', message)
  
  logError(error, {
    route: context.route || 'unknown-route',
    userId: context.userId,
    operation: 'ai-service-error',
  })

  return NextResponse.json(
    { error: errorMessage, code: 'AI_SERVICE_ERROR' },
    { status: 500 }
  )
}

/**
 * Rate limit exceeded response (429)
 */
export function rateLimitResponse(
  message: string = 'Too many requests. Please try again later.'
): NextResponse {
  return NextResponse.json(
    { error: message, code: 'RATE_LIMIT_EXCEEDED' },
    { status: 429 }
  )
}

/**
 * Stripe error response (500)
 */
export function stripeErrorResponse(
  error: unknown,
  message: string = 'Stripe operation failed',
  context: { route?: string; userId?: string } = {}
): NextResponse {
  const errorMessage = sanitizeErrorForClient(error, 'stripe-error', message)
  
  logError(error, {
    route: context.route || 'unknown-route',
    userId: context.userId,
    operation: 'stripe-error',
  })

  return NextResponse.json(
    { error: errorMessage, code: 'STRIPE_ERROR' },
    { status: 500 }
  )
}