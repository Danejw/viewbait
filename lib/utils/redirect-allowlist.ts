/**
 * Redirect allowlist (open redirect prevention)
 *
 * Used by auth callback, auth page, middleware, and onboarding to validate
 * redirect/next parameters. Only relative paths from a small allowlist are accepted.
 * Safe to use on both server and client.
 */

const ALLOWED_PATHNAMES: readonly string[] = ['/', '/studio', '/onboarding']

/**
 * Returns true if the value is an allowed redirect destination.
 * - Rejects absolute URLs (http/https) and protocol-relative (//).
 * - Rejects paths that don't start with /.
 * - Allows pathnames: /, /studio, /onboarding, and /e/<slug> (editor link).
 */
export function isAllowedRedirect(value: string): boolean {
  if (typeof value !== 'string' || !value.trim()) return false
  const trimmed = value.trim()
  if (trimmed.startsWith('//') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) return false
  if (!trimmed.startsWith('/')) return false
  const pathname = trimmed.split('?')[0]
  if (ALLOWED_PATHNAMES.includes(pathname)) return true
  if (pathname.startsWith('/e/')) {
    const slug = pathname.slice(3)
    return slug.length > 0 && /^[a-zA-Z0-9-]+$/.test(slug)
  }
  if (pathname === '/studio') return true
  return false
}

const DEFAULT_FALLBACK = '/studio'

/**
 * Returns the redirect value if allowed, otherwise the fallback (default /studio).
 */
export function getAllowedRedirect(value: string | null | undefined, fallback: string = DEFAULT_FALLBACK): string {
  if (value == null || value === '') return fallback
  return isAllowedRedirect(value) ? value.trim() : fallback
}
