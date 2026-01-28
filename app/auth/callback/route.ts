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
      logError(error, {
        route: 'GET /auth/callback',
        userId,
        operation: 'persist-youtube-tokens',
      })
    } else {
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
  // Support both 'next' and 'redirect' query params, default to /studio
  const next = requestUrl.searchParams.get('next') || requestUrl.searchParams.get('redirect') || '/studio'

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
      
      if (isGoogleOAuth && providerToken) {
        // Extract Google user ID from identity data
        const googleIdentity = user.identities?.find(
          (identity) => identity.provider === 'google'
        )
        const googleUserId = googleIdentity?.id
        
        // Extract scopes from user metadata if available
        // Note: Supabase may not always expose the exact scopes granted
        const scopes = user.app_metadata?.providers_scopes?.google as string[] | undefined
        
        // Persist tokens to database (async, don't block redirect)
        persistYouTubeTokens(
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
