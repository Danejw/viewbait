/**
 * YouTube Disconnect API Route
 * 
 * Handles disconnecting/revoking YouTube integration for authenticated users.
 * Marks the integration as revoked and optionally revokes the token at Google.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import {
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo, logWarn } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

/**
 * Google token revocation endpoint
 */
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

/**
 * Attempt to revoke the token at Google
 * This is a best-effort operation - we don't fail if it doesn't work
 */
async function revokeGoogleToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token }),
    })
    
    return response.ok
  } catch (error) {
    logWarn('Failed to revoke token at Google', {
      service: 'youtube',
      operation: 'revokeGoogleToken',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return false
  }
}

/**
 * POST /api/youtube/disconnect
 * Disconnects/revokes YouTube integration for the authenticated user
 * 
 * Body params (optional):
 * - revokeAtGoogle: boolean - If true, also revoke the token at Google (default: false)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tierName = await getTierNameForUser(supabase, user.id)
    if (tierName !== 'pro') {
      return NextResponse.json(
        {
          success: false,
          error: 'YouTube integration is available on the Pro plan.',
          code: 'TIER_REQUIRED',
        },
        { status: 403 }
      )
    }
    
    // Parse request body
    let body: { revokeAtGoogle?: boolean } = {}
    try {
      const text = await request.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch {
      // Empty body is OK, will use defaults
    }
    
    // Use service client to access tokens for revocation
    const supabaseService = createServiceClient()
    
    // Get the current integration
    const { data: integration, error: fetchError } = await supabaseService
      .from('youtube_integrations')
      .select('access_token, refresh_token, is_connected')
      .eq('user_id', user.id)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'No YouTube integration found',
          code: 'NOT_FOUND',
        }, { status: 404 })
      }
      
      logError(fetchError, {
        route: 'POST /api/youtube/disconnect',
        userId: user.id,
        operation: 'fetch-integration',
      })
      return databaseErrorResponse('Failed to fetch integration')
    }
    
    if (!integration.is_connected) {
      return NextResponse.json({
        success: true,
        message: 'YouTube integration is already disconnected',
        revokedAtGoogle: false,
      })
    }
    
    // Optionally revoke token at Google
    let revokedAtGoogle = false
    if (body.revokeAtGoogle) {
      // Prefer revoking the access token, fall back to refresh token
      const tokenToRevoke = integration.access_token || integration.refresh_token
      if (tokenToRevoke) {
        revokedAtGoogle = await revokeGoogleToken(tokenToRevoke)
        logInfo('Attempted to revoke token at Google', {
          route: 'POST /api/youtube/disconnect',
          userId: user.id,
          success: revokedAtGoogle,
        })
      }
    }
    
    // Mark the integration as revoked in our database
    const { error: updateError } = await supabaseService
      .from('youtube_integrations')
      .update({
        is_connected: false,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Clear tokens for security
        access_token: '',
        refresh_token: null,
      })
      .eq('user_id', user.id)
    
    if (updateError) {
      logError(updateError, {
        route: 'POST /api/youtube/disconnect',
        userId: user.id,
        operation: 'update-integration',
      })
      return databaseErrorResponse('Failed to disconnect YouTube integration')
    }
    
    logInfo('YouTube integration disconnected', {
      route: 'POST /api/youtube/disconnect',
      userId: user.id,
      revokedAtGoogle,
    })
    
    return NextResponse.json({
      success: true,
      message: 'YouTube integration disconnected successfully',
      revokedAtGoogle,
    })
    
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'disconnect-youtube-integration', undefined, 'Failed to disconnect YouTube integration')
  }
}
