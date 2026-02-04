/**
 * POST /api/agent/live-token
 *
 * Issues a short-lived ephemeral token for the Gemini Live API (WebSocket).
 * Pro tier required. Uses @google/genai authTokens.create; requires GEMINI_API_KEY.
 * Client uses the token as API key for Live API connection.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

const NEW_SESSION_EXPIRE_MINUTES = 1
const EXPIRE_MINUTES = 30

export async function POST() {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tierName = await getTierNameForUser(supabase, user.id)
    if (tierName !== 'pro') {
      return NextResponse.json(
        {
          success: false,
          error: 'Live voice assistant requires a Pro subscription.',
          code: 'TIER_REQUIRED',
        },
        { status: 403 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      logError(new Error('GEMINI_API_KEY not set'), {
        route: 'POST /api/agent/live-token',
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Voice service is not configured.',
          code: 'CONFIG_ERROR',
        },
        { status: 503 }
      )
    }

    const { GoogleGenAI } = await import('@google/genai')
    const client = new GoogleGenAI({ apiKey })

    const expireTime = new Date(Date.now() + EXPIRE_MINUTES * 60 * 1000).toISOString()
    const newSessionExpireTime = new Date(
      Date.now() + NEW_SESSION_EXPIRE_MINUTES * 60 * 1000
    ).toISOString()

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })

    const tokenValue = (token as { name?: string }).name
    if (!tokenValue) {
      logError(new Error('Ephemeral token missing name'), {
        route: 'POST /api/agent/live-token',
      })
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create voice session token.',
          code: 'TOKEN_ERROR',
        },
        { status: 500 }
      )
    }

    logInfo('Agent live-token issued', {
      route: 'POST /api/agent/live-token',
      userId: user.id,
    })

    return NextResponse.json({
      success: true,
      token: tokenValue,
      expiresIn: EXPIRE_MINUTES * 60,
    })
  } catch (error) {
    logError(error, {
      route: 'POST /api/agent/live-token',
      operation: 'live-token',
    })

    const message = error instanceof Error ? error.message : 'Failed to create token'
    return NextResponse.json(
      {
        success: false,
        error: message,
        code: 'TOKEN_ERROR',
      },
      { status: 500 }
    )
  }
}
