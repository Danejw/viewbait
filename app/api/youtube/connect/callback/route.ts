/**
 * YouTube Connect – OAuth callback
 *
 * Exchanges the authorization code with Google for access and refresh tokens,
 * stores them in youtube_integrations, then redirects to the app.
 * Uses the same Google OAuth client as token refresh (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const STATE_COOKIE_NAME = 'youtube_oauth_state'
const NEXT_COOKIE_NAME = 'youtube_oauth_next'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const cookieStore = await cookies()
  const nextPath = cookieStore.get(NEXT_COOKIE_NAME)?.value || '/studio'
  cookieStore.delete(NEXT_COOKIE_NAME)

  const redirectToApp = (path: string, error?: string) => {
    const url = new URL(path, request.url)
    if (error) url.searchParams.set('error', error)
    return NextResponse.redirect(url.toString())
  }

  if (errorParam) {
    return redirectToApp(nextPath, `Google+denied+access`)
  }

  if (!code || !state) {
    return redirectToApp(nextPath, `Missing+code+or+state`)
  }

  const stateCookie = cookieStore.get(STATE_COOKIE_NAME)?.value
  cookieStore.delete(STATE_COOKIE_NAME)

  if (!stateCookie || stateCookie !== state) {
    logInfo('YouTube OAuth callback: invalid or missing state', {
      route: 'GET /api/youtube/connect/callback',
      hasStateCookie: !!stateCookie,
    })
    return redirectToApp(nextPath, `Invalid+state`)
  }

  const supabase = await createClient()
  const user = await requireAuth(supabase)

  logInfo('YouTube OAuth callback hit; exchanging code for tokens', {
    route: 'GET /api/youtube/connect/callback',
    userId: user.id,
  })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return redirectToApp(nextPath, `Connect+not+configured`)
  }

  // Must match authorize redirect_uri exactly (no query params)
  const redirectUri = new URL('/api/youtube/connect/callback', request.url)

  let tokenResponse: Response
  try {
    tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri.toString(),
      }),
    })
  } catch (err) {
    logError(err instanceof Error ? err : new Error('Token exchange failed'), {
      route: 'GET /api/youtube/connect/callback',
      userId: user.id,
    })
    return redirectToApp(nextPath, `Token+exchange+failed`)
  }

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text()
    logError(new Error(`Google token error: ${tokenResponse.status}`), {
      route: 'GET /api/youtube/connect/callback',
      userId: user.id,
      body: errBody.slice(0, 200),
    })
    return redirectToApp(nextPath, `Token+exchange+failed`)
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }

  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 3600) * 1000
  ).toISOString()

  /** Google returns space-separated scopes; persist so thumbnail scope check works. */
  const scopesGranted =
    typeof tokenData.scope === 'string'
      ? tokenData.scope.trim().split(/\s+/).filter(Boolean)
      : []

  const supabaseService = createServiceClient()
  const { error: upsertError } = await supabaseService
    .from('youtube_integrations')
    .upsert({
      user_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      google_user_id: null,
      expires_at: expiresAt,
      scopes_granted: scopesGranted,
      is_connected: true,
      revoked_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (upsertError) {
    logError(upsertError, {
      route: 'GET /api/youtube/connect/callback',
      userId: user.id,
      operation: 'upsert-integration',
    })
    return redirectToApp(nextPath, `Failed+to+save+tokens`)
  }

  logInfo('YouTube integration connected via dedicated OAuth', {
    route: 'GET /api/youtube/connect/callback',
    userId: user.id,
    hasRefreshToken: !!tokenData.refresh_token,
    scopesGranted,
  })

  return redirectToApp(nextPath)
}
