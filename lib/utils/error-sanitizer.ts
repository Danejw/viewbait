/**
 * Error Sanitization Utility
 * 
 * Prevents prompt/model instruction leakage through error messages.
 * Always returns generic, safe error messages to clients while logging
 * full error details server-side only.
 */

import { logError } from '@/lib/server/utils/logger'

/**
 * Sanitize error for client response
 * 
 * Returns generic error messages that don't expose:
 * - Prompt content
 * - API keys
 * - Internal system details
 * - Stack traces
 * 
 * Full error details are logged server-side for debugging.
 */
export function sanitizeErrorForClient(
  error: unknown,
  context: string,
  defaultMessage: string
): string {
  // Log full error server-side for debugging (with PII redaction)
  logError(error, {
    operation: context,
    route: 'error-sanitizer',
  })

  if (!(error instanceof Error)) {
    return defaultMessage
  }

  const errorMessage = error.message.toLowerCase()

  // Check for known safe error types that we can return more specific messages for
  if (errorMessage.includes('gemini_api_key') || errorMessage.includes('api key')) {
    return 'AI service not configured'
  }

  if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
    return 'Authentication required'
  }

  if (errorMessage.includes('insufficient credits') || errorMessage.includes('credits')) {
    return 'Insufficient credits'
  }

  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return 'Resource not found'
  }

  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return 'Invalid request'
  }

  if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('rate_limit')) {
    return 'AI service is busy. Please try again in a moment.'
  }

  // For any other error, return the generic default message
  // This prevents leaking prompts, API responses, or internal details
  return defaultMessage
}

/**
 * Sanitize API error response text
 * 
 * Redacts potentially sensitive information from API error responses
 * before logging or including in error messages.
 */
export function sanitizeApiErrorResponse(errorText: string): string {
  // Remove potential prompt content (look for long text blocks)
  let sanitized = errorText

  // Remove any text that looks like a prompt (long strings with instructions)
  // This is a conservative approach - better to remove too much than leak prompts
  sanitized = sanitized.replace(/[A-Z][^.!?]{100,}/g, '[REDACTED: Potential prompt content]')

  // Remove API keys (hex strings, base64-like strings)
  sanitized = sanitized.replace(/[A-Za-z0-9_-]{32,}/g, (match) => {
    // Keep short identifiers, but redact long strings that could be keys
    return match.length > 40 ? '[REDACTED: Potential API key]' : match
  })

  // Remove base64-encoded data
  sanitized = sanitized.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{50,}/g, '[REDACTED: Base64 image data]')

  return sanitized
}
