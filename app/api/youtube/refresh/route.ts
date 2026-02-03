/**
 * YouTube Token Refresh API Route
 * 
 * Handles refreshing Google OAuth access tokens when they expire.
 * Uses the stored refresh token to obtain new access tokens from Google.
 * This route uses service role credentials to access stored tokens securely.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo, logWarn } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

/**
 * Google OAuth token endpoint
 */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

/**
 * Response from Google's token refresh endpoint
 */
interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  // refresh_token is only returned if using approval_prompt=force
  refresh_token?: string
}

/**
 * Error response from Google's token endpoint
 */
interface GoogleTokenError {
  error: string
  error_description?: string
}

/**
 * Refresh Google OAuth access token using the refresh token
 */
async function refreshGoogleToken(refreshToken: string): Promise<{
  success: boolean
  accessToken?: string
  expiresIn?: number
  error?: string
  errorCode?: string
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'Google OAuth credentials not configured',
      errorCode: 'MISSING_CREDENTIALS',
    }
  }
  
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    
    if (!response.ok) {
      const errorData: GoogleTokenError = await response.json()
      
      // Handle specific error cases
      if (errorData.error === 'invalid_grant') {
        return {
          success: false,
          error: 'Refresh token has been revoked or expired. User needs to re-authenticate.',
          errorCode: 'INVALID_GRANT',
        }
      }
      
      return {
        success: false,
        error: errorData.error_description || errorData.error || 'Token refresh failed',
        errorCode: errorData.error,
      }
    }
    
    const data: GoogleTokenResponse = await response.json()
    
    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error during token refresh',
      errorCode: 'NETWORK_ERROR',
    }
  }
}

/**
 * POST /api/youtube/refresh
 * Refresh the YouTube integration access token for the authenticated user
 * 
 * Returns:
 * - success: true with new access token if refresh succeeded
 * - success: false with error details if refresh failed
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    
    // Use service client to access tokens (bypasses RLS)
    const supabaseService = createServiceClient()
    
    // Get the user's integration record with tokens
    const { data: integration, error: fetchError } = await supabaseService
      .from('youtube_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_connected', true)
      .single()
    
    if (fetchError || !integration) {
      logWarn('No YouTube integration found for user', {
        route: 'POST /api/youtube/refresh',
        userId: user.id,
        error: fetchError?.message,
      })
      return NextResponse.json({
        success: false,
        error: 'No YouTube integration found',
        code: 'NOT_CONNECTED',
      }, { status: 404 })
    }
    
    // Check if we have a refresh token
    if (!integration.refresh_token) {
      logWarn('No refresh token available for YouTube integration', {
        route: 'POST /api/youtube/refresh',
        userId: user.id,
      })
      return NextResponse.json({
        success: false,
        error: 'No refresh token available. User needs to re-authenticate with YouTube.',
        code: 'NO_REFRESH_TOKEN',
      }, { status: 400 })
    }
    
    // Check if the current token is still valid (with 5 min buffer)
    const expiresAt = new Date(integration.expires_at)
    const bufferMs = 5 * 60 * 1000 // 5 minutes
    const needsRefresh = expiresAt.getTime() - Date.now() < bufferMs
    
    if (!needsRefresh) {
      logInfo('Access token still valid, no refresh needed', {
        route: 'POST /api/youtube/refresh',
        userId: user.id,
        expiresAt: integration.expires_at,
      })
      return NextResponse.json({
        success: true,
        message: 'Access token is still valid',
        expiresAt: integration.expires_at,
      })
    }
    
    // Refresh the token
    const refreshResult = await refreshGoogleToken(integration.refresh_token)
    
    if (!refreshResult.success) {
      logError(new Error(refreshResult.error || 'Token refresh failed'), {
        route: 'POST /api/youtube/refresh',
        userId: user.id,
        errorCode: refreshResult.errorCode,
      })
      
      // If the refresh token is invalid, mark the integration as disconnected
      if (refreshResult.errorCode === 'INVALID_GRANT') {
        await supabaseService
          .from('youtube_integrations')
          .update({
            is_connected: false,
            revoked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      }
      
      return NextResponse.json({
        success: false,
        error: refreshResult.error,
        code: refreshResult.errorCode,
        requiresReauth: refreshResult.errorCode === 'INVALID_GRANT',
      }, { status: 400 })
    }
    
    // Calculate new expiry time
    const newExpiresAt = new Date(
      Date.now() + (refreshResult.expiresIn || 3600) * 1000
    ).toISOString()
    
    // Update the stored access token
    const { error: updateError } = await supabaseService
      .from('youtube_integrations')
      .update({
        access_token: refreshResult.accessToken,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    
    if (updateError) {
      logError(updateError, {
        route: 'POST /api/youtube/refresh',
        userId: user.id,
        operation: 'update-access-token',
      })
      return databaseErrorResponse('Failed to store refreshed token')
    }
    
    logInfo('YouTube access token refreshed successfully', {
      route: 'POST /api/youtube/refresh',
      userId: user.id,
      expiresAt: newExpiresAt,
    })
    
    return NextResponse.json({
      success: true,
      message: 'Access token refreshed successfully',
      expiresAt: newExpiresAt,
    })
    
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'refresh-youtube-token', undefined, 'Failed to refresh YouTube token')
  }
}
