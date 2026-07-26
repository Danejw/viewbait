/**
 * Builds the relative auth redirect for MCP OAuth consent when the user is signed out.
 * Must stay relative so redirect-allowlist can validate it (no open redirects).
 */
export function buildOAuthConsentAuthRedirect(authorizationId: string): string {
  const returnTo = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
  return `/auth?redirect=${encodeURIComponent(returnTo)}`
}
