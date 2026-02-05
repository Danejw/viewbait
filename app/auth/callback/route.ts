/**
 * Auth Callback Route
 * 
 * Handles OAuth callbacks and email confirmation redirects from Supabase.
 * This route exchanges the authorization code for a session, captures provider
 * tokens for YouTube integration, and redirects the user.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { getAllowedRedirect } from '@/lib/utils/redirect-allowlist'

/**
 * Persist YouTube integration tokens to the database
 * Uses service role to bypass RLS and securely store tokens
 */
async function persistYouTubeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | undefined,
  googleUserId: string | undefined,
  scopes: string[] | undefined
): Promise<void> {
  // #region agent log
  fetch('http://127.0.0.1:7250/ingest/503c3a58-0894-4f46-a41c-96a198c9eec9', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'auth/callback/route.ts:persistYouTubeTokens', message: 'persistYouTubeTokens called', data: { userIdPrefix: userId?.slice(0, 8), hasRefreshToken: !!refreshToken }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'E' }) }).catch(() => {})
  // #endregion
  try {
    const supabaseService = createServiceClient()
    
    // Calculate expiry (Google access tokens typically expire in 1 hour)
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
    
    // Upsert the integration record
    const { error } = await supabaseService
      .from('youtube_integrations')
      .upsert({
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken || null,
        google_user_id: googleUserId || null,
        expires_at: expiresAt,
        scopes_granted: scopes || [],
        is_connected: true,
        revoked_at: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
    
    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7250/ingest/503c3a58-0894-4f46-a41c-96a198c9eec9', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'auth/callback/route.ts:persistError', message: 'persistYouTubeTokens upsert error', data: { userIdPrefix: userId?.slice(0, 8), errorCode: error?.code }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'E' }) }).catch(() => {})
      // #endregion
      logError(error, {
        route: 'GET /auth/callback',
        userId,
        operation: 'persist-youtube-tokens',
      })
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7250/ingest/503c3a58-0894-4f46-a41c-96a198c9eec9', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'auth/callback/route.ts:persistSuccess', message: 'persistYouTubeTokens upsert success', data: { userIdPrefix: userId?.slice(0, 8) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'E' }) }).catch(() => {})
      // #endregion
      logInfo('YouTube integration tokens persisted successfully', {
        route: 'GET /auth/callback',
        userId,
        hasRefreshToken: !!refreshToken,
        scopesCount: scopes?.length || 0,
      })
    }
  } catch (error) {
    logError(error, {
      route: 'GET /auth/callback',
      userId,
      operation: 'persist-youtube-tokens',
    })
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const rawNext = requestUrl.searchParams.get('next') || requestUrl.searchParams.get('redirect')
  const next = getAllowedRedirect(rawNext, '/studio')

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // Extract provider tokens from the session IMMEDIATELY after exchange
      // These tokens are only available in the initial exchange response
      const providerToken = data.session.provider_token
      const providerRefreshToken = data.session.provider_refresh_token
      const user = data.session.user
      
      // Check if this is a Google OAuth login
      // IMPORTANT: user.app_metadata.provider is the PRIMARY auth method (could be "email" even if user signed in with Google)
      // Instead, check if there's a Google identity OR if "google" is in the providers array
      const hasGoogleIdentity = user.identities?.some(identity => identity.provider === 'google')
      const hasGoogleInProviders = user.app_metadata?.providers?.includes('google')
      const isGoogleOAuth = hasGoogleIdentity || hasGoogleInProviders
      const willPersist = isGoogleOAuth && !!providerToken
      // #region agent log
      fetch('http://127.0.0.1:7250/ingest/503c3a58-0894-4f46-a41c-96a198c9eec9', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'auth/callback/route.ts:afterExchange', message: 'Auth callback after exchangeCodeForSession', data: { hasProviderToken: !!providerToken, hasProviderRefreshToken: !!providerRefreshToken, isGoogleOAuth, willPersist, userIdPrefix: user.id?.slice(0, 8) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: willPersist ? 'A' : 'A' }) }).catch(() => {})
      if (isGoogleOAuth && !providerToken) {
        fetch('http://127.0.0.1:7250/ingest/503c3a58-0894-4f46-a41c-96a198c9eec9', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'auth/callback/route.ts:skipPersist', message: 'Google OAuth but no provider_token - skipping YouTube token persist', data: { userIdPrefix: user.id?.slice(0, 8) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A' }) }).catch(() => {})
      }
      // #endregion
      if (isGoogleOAuth && providerToken) {
        // Extract Google user ID from identity data
        const googleIdentity = user.identities?.find(
          (identity) => identity.provider === 'google'
        )
        const googleUserId = googleIdentity?.id
        
        // Extract scopes from user metadata if available
        // Note: Supabase may not always expose the exact scopes granted
        const scopes = user.app_metadata?.providers_scopes?.google as string[] | undefined
        
        // Persist tokens to database before redirect so set-thumbnail etc. use the new token
        // #region agent log
        fetch('http://127.0.0.1:7250/ingest/503c3a58-0894-4f46-a41c-96a198c9eec9', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'auth/callback/route.ts:beforePersist', message: 'About to persist YouTube tokens', data: { userIdPrefix: user.id?.slice(0, 8) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A' }) }).catch(() => {})
        // #endregion
        await persistYouTubeTokens(
          user.id,
          providerToken,
          providerRefreshToken ?? undefined,
          googleUserId,
          scopes
        ).catch((err) => {
          logError(err, {
            route: 'GET /auth/callback',
            userId: user.id,
            operation: 'persist-youtube-tokens-background',
          })
        })
        // #region agent log
        fetch('http://127.0.0.1:7250/ingest/503c3a58-0894-4f46-a41c-96a198c9eec9', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'auth/callback/route.ts:afterPersistAwait', message: 'Persist YouTube tokens await completed', data: { userIdPrefix: user.id?.slice(0, 8) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'E' }) }).catch(() => {})
        // #endregion
      }
      
      // Successfully authenticated, redirect to the app
      return NextResponse.redirect(new URL(next, request.url))
    }
    
    // Log the error for debugging
    if (error) {
      logError(error, {
        route: 'GET /auth/callback',
        operation: 'exchange-code-for-session',
      })
    }
  }

  // If there's an error or no code, redirect to home with error message
  return NextResponse.redirect(
    new URL(`/?error=Could not authenticate user`, request.url)
  )
}
