/**
 * Server-Side Logging Utility
 * 
 * Provides structured logging with PII redaction for production safety.
 * All logs are sanitized to prevent exposure of sensitive data.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface LogContext {
  route?: string
  userId?: string
  operation?: string
  [key: string]: unknown
}

/**
 * Hash user ID for logging (first 8 chars + hash indicator)
 * Prevents full user ID exposure in logs while maintaining traceability
 */
function hashUserId(userId: string): string {
  if (!userId || userId.length < 8) {
    return '[REDACTED:USER_ID]'
  }
  return `${userId.substring(0, 8)}...`
}

/**
 * Redact PII from data objects
 */
function redactPII(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }

  // Handle strings - check for PII patterns
  if (typeof data === 'string') {
    let sanitized = data

    // Redact email addresses
    sanitized = sanitized.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      '[REDACTED:EMAIL]'
    )

    // Redact API keys (long alphanumeric strings, typically 32+ chars)
    sanitized = sanitized.replace(
      /[A-Za-z0-9_-]{32,}/g,
      (match) => {
        // Skip if it's a UUID (has dashes in the right places)
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match)) {
          return match
        }
        // Skip if it's a short identifier (likely not an API key)
        if (match.length < 40) {
          return match
        }
        return '[REDACTED:API_KEY]'
      }
    )

    // Redact JWT tokens (starts with eyJ)
    sanitized = sanitized.replace(
      /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g,
      '[REDACTED:TOKEN]'
    )

    // Redact base64 image data
    sanitized = sanitized.replace(
      /data:image\/[^;]+;base64,[A-Za-z0-9+/=]{50,}/g,
      '[REDACTED:IMAGE_DATA]'
    )

    // Redact passwords (common patterns)
    sanitized = sanitized.replace(
      /(password|pwd|passwd|secret)[\s:=]+['"]?[^'"]+['"]?/gi,
      (match) => {
        const parts = match.split(/[\s:=]+/)
        if (parts.length > 1) {
          return `${parts[0]}=[REDACTED:PASSWORD]`
        }
        return '[REDACTED:PASSWORD]'
      }
    )

    return sanitized
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactPII(item))
  }

  // Handle objects
  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()
      
      // Redact known PII fields
      if (lowerKey.includes('email')) {
        sanitized[key] = '[REDACTED:EMAIL]'
      } else if (lowerKey.includes('password') || lowerKey.includes('pwd') || lowerKey.includes('secret')) {
        sanitized[key] = '[REDACTED:PASSWORD]'
      } else if (lowerKey.includes('token') || lowerKey.includes('auth')) {
        sanitized[key] = typeof value === 'string' && value.length > 20 
          ? '[REDACTED:TOKEN]' 
          : redactPII(value)
      } else if (lowerKey === 'user_id' || lowerKey === 'userId') {
        sanitized[key] = typeof value === 'string' ? hashUserId(value) : '[REDACTED:USER_ID]'
      } else if (lowerKey.includes('api_key') || lowerKey.includes('apikey')) {
        sanitized[key] = '[REDACTED:API_KEY]'
      } else {
        sanitized[key] = redactPII(value)
      }
    }
    
    return sanitized
  }

  return data
}

/**
 * Extract error information safely
 */
function extractErrorInfo(error: unknown): {
  message: string
  type: string
  stack?: string
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      type: error.constructor.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }
  }
  
  // Handle Supabase/PostgREST errors which are objects with code, message, details, hint
  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>
    const message = errorObj.message || errorObj.error || errorObj.details || JSON.stringify(errorObj)
    return {
      message: String(message),
      type: errorObj.constructor?.name || typeof error,
    }
  }
  
  return {
    message: String(error),
    type: typeof error,
  }
}

/**
 * Format log entry
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext,
  error?: unknown
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    level,
    message: redactPII(message),
    timestamp: new Date().toISOString(),
  }

  // Add context (with PII redaction)
  if (context.route) {
    entry.route = context.route
  }
  
  if (context.userId) {
    entry.userId = hashUserId(context.userId)
  }
  
  if (context.operation) {
    entry.operation = context.operation
  }

  // Add other context fields (redacted)
  for (const [key, value] of Object.entries(context)) {
    if (!['route', 'userId', 'operation'].includes(key)) {
      entry[key] = redactPII(value)
    }
  }

  // Add error information if provided
  if (error !== undefined) {
    const errorInfo = extractErrorInfo(error)
    entry.error = {
      message: redactPII(errorInfo.message),
      type: errorInfo.type,
    }
    
    // Only include stack trace in development
    if (errorInfo.stack && process.env.NODE_ENV === 'development') {
      entry.error.stack = redactPII(errorInfo.stack)
    }
  }

  return entry
}

/**
 * Log error
 */
export function logError(
  error: unknown,
  context: LogContext = {}
): void {
  const entry = formatLogEntry('error', 'Error occurred', context, error)
  
  if (process.env.NODE_ENV === 'production') {
    // In production, use structured logging (can be sent to logging service)
    // For now, log as JSON for easy parsing
    console.error(JSON.stringify(entry))
  } else {
    // In development, use more readable format
    console.error(`[ERROR] ${entry.message}`, {
      ...entry,
      error: entry.error,
    })
  }
}

/**
 * Log warning
 */
export function logWarn(
  message: string,
  context: LogContext = {}
): void {
  const entry = formatLogEntry('warn', message, context)
  
  if (process.env.NODE_ENV === 'production') {
    console.warn(JSON.stringify(entry))
  } else {
    console.warn(`[WARN] ${entry.message}`, entry)
  }
}

/**
 * Log info
 */
export function logInfo(
  message: string,
  context: LogContext = {}
): void {
  const entry = formatLogEntry('info', message, context)
  
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(entry))
  } else {
    console.log(`[INFO] ${entry.message}`, entry)
  }
}

/**
 * Log debug (only in development)
 */
export function logDebug(
  message: string,
  context: LogContext = {}
): void {
  if (process.env.NODE_ENV === 'development') {
    const entry = formatLogEntry('debug', message, context)
    console.debug(`[DEBUG] ${entry.message}`, entry)
  }
}

