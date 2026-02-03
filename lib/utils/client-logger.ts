/**
 * Client-Side Logging Utility
 * 
 * Provides safe error logging for client-side code.
 * Never logs PII, full error objects, or sensitive data.
 * In production, suppresses detailed error logging.
 */

export type ClientLogLevel = 'error' | 'warn' | 'info'

export interface ClientLogContext {
  operation?: string
  component?: string
  [key: string]: unknown
}

/**
 * Extract safe error information (no PII, no stack traces)
 */
function extractSafeErrorInfo(error: unknown): {
  type: string
  code?: string
  message?: string
} {
  if (error instanceof Error) {
    // Extract error code if available (from API responses)
    const codeMatch = error.message.match(/code:\s*['"]?([A-Z_]+)['"]?/i)
    const code = codeMatch ? codeMatch[1] : undefined

    // Sanitize message - only keep safe parts
    let message = error.message
    // Remove any potential PII patterns
    message = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED]')
    message = message.replace(/[A-Za-z0-9_-]{32,}/g, '[REDACTED]')
    
    return {
      type: error.constructor.name,
      code,
      message: message.length > 100 ? message.substring(0, 100) + '...' : message,
    }
  }

  return {
    type: typeof error,
  }
}

/**
 * Redact PII from context data
 */
function redactContext(context: ClientLogContext): ClientLogContext {
  const sanitized: ClientLogContext = {}

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase()

    // Never log user IDs, emails, or tokens
    if (
      lowerKey.includes('user') ||
      lowerKey.includes('email') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('api_key')
    ) {
      continue // Skip PII fields
    }

    // Sanitize string values
    if (typeof value === 'string') {
      let sanitizedValue = value
      // Remove email addresses
      sanitizedValue = sanitizedValue.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        '[REDACTED]'
      )
      // Remove long strings that might be tokens/keys
      sanitizedValue = sanitizedValue.replace(/[A-Za-z0-9_-]{32,}/g, '[REDACTED]')
      sanitized[key] = sanitizedValue
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Log error (client-side safe)
 * Only logs error type/code, never full error objects or PII
 */
export function logClientError(
  error: unknown,
  context: ClientLogContext = {}
): void {
  const errorInfo = extractSafeErrorInfo(error)
  const sanitizedContext = redactContext(context)

  const errorPayload: Record<string, unknown> = {
    type: errorInfo.type,
    ...(errorInfo.code != null ? { code: errorInfo.code } : {}),
  }
  if (process.env.NODE_ENV === 'development' && errorInfo.message) {
    errorPayload.message = errorInfo.message
  } else if (!errorInfo.message && process.env.NODE_ENV === 'development') {
    errorPayload.message = String(error)
  }

  const logEntry = {
    level: 'error' as const,
    error: errorPayload,
    context: sanitizedContext,
    timestamp: new Date().toISOString(),
  }

  if (process.env.NODE_ENV === 'production') {
    // In production, only log to console if absolutely necessary
    // Most production apps should send to error tracking service instead
    console.error('[ERROR]', {
      type: errorInfo.type,
      code: errorInfo.code,
      operation: sanitizedContext.operation,
    })
  } else {
    // In development, log more details (but still sanitized)
    console.error('[CLIENT ERROR]', logEntry)
  }

  // Optional: Report to server-side logging for debugging
  // This can be enabled for production error tracking
  if (process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING === 'true') {
    reportErrorToServer(errorInfo, sanitizedContext).catch(() => {
      // Silently fail - don't break the app if error reporting fails
    })
  }
}

/**
 * Log warning (client-side safe)
 */
export function logClientWarn(
  message: string,
  context: ClientLogContext = {}
): void {
  const sanitizedContext = redactContext(context)

  if (process.env.NODE_ENV === 'production') {
    console.warn('[WARN]', message, sanitizedContext.operation || '')
  } else {
    console.warn('[CLIENT WARN]', message, sanitizedContext)
  }
}

/**
 * Log info (client-side safe)
 */
export function logClientInfo(
  message: string,
  context: ClientLogContext = {}
): void {
  const sanitizedContext = redactContext(context)

  if (process.env.NODE_ENV === 'production') {
    // Suppress info logs in production
    return
  }

  console.log('[CLIENT INFO]', message, sanitizedContext)
}

/**
 * Report error to server-side logging (optional, for debugging)
 */
async function reportErrorToServer(
  errorInfo: { type: string; code?: string; message?: string },
  context: ClientLogContext
): Promise<void> {
  try {
    // Only report in production or when explicitly enabled
    if (process.env.NODE_ENV !== 'production' && 
        process.env.NEXT_PUBLIC_ENABLE_ERROR_REPORTING !== 'true') {
      return
    }

    // Send to a server-side endpoint for logging
    // This endpoint should be created separately if needed
    await fetch('/api/log-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: errorInfo,
        context: context,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
    })
  } catch {
    // Silently fail - don't break the app
  }
}

