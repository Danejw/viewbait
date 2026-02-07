/**
 * YouTube Connect – OAuth callback (app-owned flow)
 *
 * GET /api/youtube/connect/callback
 * Exchanges the authorization code for tokens with Google, persists them to
 * youtube_integrations, then redirects to the path stored in the state cookie.
 * The token response from Google includes the actual granted scopes so we
 * store those (no Supabase scope stripping).
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { YOUTUBE_SCOPES_REQUESTED } from '@/lib/constants/youtube'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const COOKIE_STATE = 'youtube_connect_state'
const COOKIE_NEXT = 'youtube_connect_next'
const DEFAULT_NEXT = '/studio?view=youtube'

function clearStateCookies(response: NextResponse): void {
  response.cookies.set(COOKIE_STATE, '', { path: '/', maxAge: 0 })
  response.cookies.set(COOKIE_NEXT, '', { path: '/', maxAge: 0 })
}

function getBaseUrl(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env) return env.replace(/\/$/, '')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? (request.headers.get('host')?.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope?: string
  refresh_token?: string
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const errorParam = requestUrl.searchParams.get('error')

  if (errorParam) {
    logError(new Error(`YouTube connect callback error from Google: ${errorParam}`), {
      route: 'GET /api/youtube/connect/callback',
      error: errorParam,
      errorDescription: requestUrl.searchParams.get('error_description') ?? undefined,
    })
    const baseUrl = getBaseUrl(request)
    const res = NextResponse.redirect(`${baseUrl}/studio?view=youtube&youtube_connect=error`, { status: 302 })
    clearStateCookies(res)
    return res
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing code or state', code: 'INVALID_CALLBACK' },
      { status: 400 }
    )
  }

  const stateCookie = request.cookies.get(COOKIE_STATE)?.value
  const nextCookie = request.cookies.get(COOKIE_NEXT)?.value ?? DEFAULT_NEXT

  if (!stateCookie || stateCookie !== state) {
    return NextResponse.json(
      { error: 'Invalid or expired state', code: 'INVALID_STATE' },
      { status: 400 }
    )
  }

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tierName = await getTierNameForUser(supabase, user.id)
    if (tierName !== 'pro') {
      const baseUrl = getBaseUrl(request)
      const res = NextResponse.redirect(`${baseUrl}${nextCookie}`, { status: 302 })
      clearStateCookies(res)
      return res
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      logError(new Error('YouTube connect callback: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET'), {
        route: 'GET /api/youtube/connect/callback',
      })
      const baseUrl = getBaseUrl(request)
      const res = NextResponse.redirect(`${baseUrl}${nextCookie}?youtube_connect=error`, { status: 302 })
      clearStateCookies(res)
      return res
    }

    const baseUrl = getBaseUrl(request)
    const redirectUri = `${baseUrl}/api/youtube/connect/callback`

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.json().catch(() => ({})) as { error?: string; error_description?: string }
      logError(new Error(`Google token exchange failed: ${errBody.error_description ?? errBody.error ?? tokenRes.statusText}`), {
        route: 'GET /api/youtube/connect/callback',
        userId: user.id,
        status: tokenRes.status,
      })
      const res = NextResponse.redirect(`${baseUrl}${nextCookie}?youtube_connect=error`, { status: 302 })
      clearStateCookies(res)
      return res
    }

    const data = tokenRes.json() as Promise<GoogleTokenResponse>
    const tokenData = await data
    const grantedScope = tokenData.scope
    const scopes = grantedScope
      ? grantedScope.trim().split(/\s+/).filter(Boolean)
      : YOUTUBE_SCOPES_REQUESTED
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString()

    // Verify the token has YouTube access (channels.list requires youtube.readonly or broader).
    // If this 403s, the token does not have the requested scopes (e.g. consent screen or app not verified).
    const channelsRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    )
    const tokenHasYouTubeAccess = channelsRes.ok
    if (!channelsRes.ok) {
      const errBody = await channelsRes.json().catch(() => ({})) as { error?: { message?: string; errors?: unknown[] } }
      logError(new Error(`YouTube token verification failed after connect: ${errBody?.error?.message ?? channelsRes.status}`), {
        route: 'GET /api/youtube/connect/callback',
        userId: user.id,
        status: channelsRes.status,
        grantedScope: grantedScope ?? '(none in response)',
        apiErrors: errBody?.error?.errors ?? [],
      })
    }
    logInfo('YouTube connect callback: token verification', {
      route: 'GET /api/youtube/connect/callback',
      userId: user.id,
      tokenHasYouTubeAccess,
      grantedScopeCount: scopes.length,
      hasForceSsl: scopes.includes('https://www.googleapis.com/auth/youtube.force-ssl'),
    })

    const supabaseService = createServiceClient()
    const { error: upsertError } = await supabaseService
      .from('youtube_integrations')
      .upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        google_user_id: null,
        expires_at: expiresAt,
        scopes_granted: scopes,
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
      const res = NextResponse.redirect(`${baseUrl}${nextCookie}?youtube_connect=error`, { status: 302 })
      clearStateCookies(res)
      return res
    }

    logInfo('YouTube integration connected via app-owned OAuth', {
      route: 'GET /api/youtube/connect/callback',
      userId: user.id,
      hasRefreshToken: !!tokenData.refresh_token,
      scopesCount: scopes.length,
    })

    const res = NextResponse.redirect(`${baseUrl}${nextCookie}`, { status: 302 })
    clearStateCookies(res)
    return res
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'status' in e) return e as NextResponse
    logError(e instanceof Error ? e : new Error('YouTube connect callback failed'), {
      route: 'GET /api/youtube/connect/callback',
    })
    const baseUrl = getBaseUrl(request)
    const res = NextResponse.redirect(`${baseUrl}${nextCookie ?? DEFAULT_NEXT}?youtube_connect=error`, { status: 302 })
    clearStateCookies(res)
    return res
  }
}
