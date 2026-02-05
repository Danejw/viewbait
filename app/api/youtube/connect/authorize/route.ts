/**
 * YouTube Connect – Start OAuth (authorize)
 *
 * Redirects the authenticated user to Google OAuth with YouTube scopes.
 * Uses our own client ID so we get tokens with the requested scopes.
 * Callback: GET /api/youtube/connect/callback
 *
 * Requires: Add http://localhost:3000/api/youtube/connect/callback (and production URL)
 * to the OAuth 2.0 client "Authorized redirect URIs" in Google Cloud Console.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const YOUTUBE_SCOPES =
  'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.force-ssl'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const STATE_COOKIE_NAME = 'youtube_oauth_state'
const NEXT_COOKIE_NAME = 'youtube_oauth_next'
const STATE_COOKIE_MAX_AGE = 600 // 10 minutes

export async function GET(request: Request) {
  const supabase = await createClient()
  const user = await requireAuth(supabase)

  const tierName = await getTierNameForUser(supabase, user.id)
  if (tierName !== 'pro') {
    return NextResponse.redirect(
      new URL('/studio?error=YouTube+integration+is+available+on+the+Pro+plan', request.url)
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(
      new URL('/studio?error=YouTube+connect+not+configured', request.url)
    )
  }

  const { searchParams } = new URL(request.url)
  const nextPath = searchParams.get('next') || '/studio'

  const state = crypto.randomUUID()
  const cookieStore = await cookies()
  cookieStore.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_COOKIE_MAX_AGE,
    path: '/',
  })
  cookieStore.set(NEXT_COOKIE_NAME, nextPath, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_COOKIE_MAX_AGE,
    path: '/',
  })

  // redirect_uri must match GCP exactly (no query params) — pass return path via cookie
  const redirectUri = new URL('/api/youtube/connect/callback', request.url)

  const authUrl = new URL(GOOGLE_AUTH_URL)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri.toString())
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', YOUTUBE_SCOPES)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', state)

  logInfo('YouTube connect authorize: redirecting to Google', {
    route: 'GET /api/youtube/connect/authorize',
    userId: user.id,
    redirectUri: redirectUri.toString(),
  })
  // #region agent log
  fetch('http://127.0.0.1:7250/ingest/503c3a58-0894-4f46-a41c-96a198c9eec9', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'youtube/connect/authorize:redirect', message: 'Redirecting to Google for YouTube OAuth', data: { userIdPrefix: user.id?.slice(0, 8) }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'fix' }) }).catch(() => {})
  // #endregion
  return NextResponse.redirect(authUrl.toString())
}
