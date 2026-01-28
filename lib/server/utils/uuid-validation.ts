/**
 * UUID Validation Utility
 * 
 * Validates UUID format to prevent injection attacks in queries.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Check if a string is a valid UUID format
 */
export function isUUID(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }
  return UUID_REGEX.test(value.trim())
}

/**
 * Validate and sanitize a style/palette identifier
 * Returns the sanitized value or null if invalid
 */
export function validateStyleIdentifier(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null
  }
  
  const trimmed = value.trim()
  
  // If it's a UUID, validate format
  if (isUUID(trimmed)) {
    return trimmed
  }
  
  // If it's a name, validate it's alphanumeric with spaces, dashes, underscores
  // Max length 100 characters
  if (trimmed.length > 100) {
    return null
  }
  
  // Allow alphanumeric, spaces, dashes, underscores
  if (!/^[a-zA-Z0-9\s_-]+$/.test(trimmed)) {
    return null
  }
  
  return trimmed
}
