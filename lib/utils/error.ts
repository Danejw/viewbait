/**
 * Client-safe error utilities.
 * Use for extracting display messages from unknown errors in UI/hooks.
 * Does not log (unlike server error-sanitizer).
 */

/**
 * Extract a safe display message from an unknown error.
 * Use in catch blocks and when setting form/UI error state.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}
