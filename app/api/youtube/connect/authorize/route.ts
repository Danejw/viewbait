/**
 * YouTube Connect – Start OAuth (app-owned flow)
 *
 * GET /api/youtube/connect/authorize
 * Builds the Google OAuth URL with the exact YouTube scopes we need (including
 * youtube.force-ssl and youtube.upload), sets CSRF state in a cookie, then
 * redirects the user to Google. After consent, Google redirects to
 * /api/youtube/connect/callback.
 *
 * Query: next (optional) – allowed redirect after callback (default /studio?view=youtube).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { getAllowedRedirect } from '@/lib/utils/redirect-allowlist'
import { YOUTUBE_SCOPES_REQUESTED } from '@/lib/constants/youtube'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const COOKIE_STATE = 'youtube_connect_state'
const COOKIE_NEXT = 'youtube_connect_next'
const STATE_TTL_SEC = 600

function getBaseUrl(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env) return env.replace(/\/$/, '')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') ?? (request.headers.get('host')?.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tierName = await getTierNameForUser(supabase, user.id)
    if (tierName !== 'pro') {
      return NextResponse.json(
        { success: false, error: 'YouTube integration is available on the Pro plan.', code: 'TIER_REQUIRED' },
        { status: 403 }
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'YouTube connect is not configured.', code: 'MISSING_CREDENTIALS' },
        { status: 500 }
      )
    }

    const nextPath = getAllowedRedirect(request.nextUrl.searchParams.get('next') ?? null, '/studio?view=youtube')
    const baseUrl = getBaseUrl(request)
    const redirectUri = `${baseUrl}/api/youtube/connect/callback`
    const state = randomBytes(16).toString('hex')
    const scope = YOUTUBE_SCOPES_REQUESTED.join(' ')

    const authUrl = new URL(GOOGLE_AUTH_URL)
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('state', state)

    const res = NextResponse.redirect(authUrl.toString(), { status: 302 })
    res.cookies.set(COOKIE_STATE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: STATE_TTL_SEC,
    })
    res.cookies.set(COOKIE_NEXT, nextPath, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: STATE_TTL_SEC,
    })
    return res
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'status' in e) return e as NextResponse
    return NextResponse.json(
      { success: false, error: 'Failed to start YouTube connect' },
      { status: 500 }
    )
  }
}
