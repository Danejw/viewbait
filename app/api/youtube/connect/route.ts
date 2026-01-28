/**
 * YouTube Connect API Route
 * 
 * Handles secure storage of YouTube integration tokens.
 * This route is used internally by the auth callback and for reconnection flows.
 * Uses service role to bypass RLS and securely store sensitive tokens.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

interface ConnectRequestBody {
  accessToken: string
  refreshToken?: string
  googleUserId?: string
  scopes?: string[]
  expiresAt?: string
}

/**
 * POST /api/youtube/connect
 * Store YouTube integration tokens for the authenticated user
 * 
 * This endpoint can be used for:
 * 1. Initial connection after OAuth callback
 * 2. Reconnection when user re-authorizes
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    
    // Parse request body
    let body: ConnectRequestBody
    try {
      body = await request.json()
    } catch {
      return validationErrorResponse('Invalid JSON body')
    }
    
    // Validate required fields
    if (!body.accessToken) {
      return validationErrorResponse('Access token is required')
    }
    
    // Use service client to bypass RLS for secure token storage
    const supabaseService = createServiceClient()
    
    // Calculate expiry - default to 1 hour if not provided
    const expiresAt = body.expiresAt || new Date(Date.now() + 3600 * 1000).toISOString()
    
    // Upsert the integration record
    const { error: upsertError } = await supabaseService
      .from('youtube_integrations')
      .upsert({
        user_id: user.id,
        access_token: body.accessToken,
        refresh_token: body.refreshToken || null,
        google_user_id: body.googleUserId || null,
        expires_at: expiresAt,
        scopes_granted: body.scopes || [],
        is_connected: true,
        revoked_at: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
    
    if (upsertError) {
      logError(upsertError, {
        route: 'POST /api/youtube/connect',
        userId: user.id,
        operation: 'upsert-integration',
      })
      return databaseErrorResponse('Failed to store YouTube integration')
    }
    
    logInfo('YouTube integration connected successfully', {
      route: 'POST /api/youtube/connect',
      userId: user.id,
      hasRefreshToken: !!body.refreshToken,
      scopesCount: body.scopes?.length || 0,
    })
    
    return NextResponse.json({
      success: true,
      message: 'YouTube integration connected successfully',
    }, { status: 201 })
    
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to connect YouTube integration')
  }
}

/**
 * DELETE /api/youtube/connect
 * Alias for disconnect - marks the integration as revoked
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    
    // Use service client to bypass RLS
    const supabaseService = createServiceClient()
    
    // Mark the integration as revoked (soft delete)
    const { error: updateError } = await supabaseService
      .from('youtube_integrations')
      .update({
        is_connected: false,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    
    if (updateError) {
      logError(updateError, {
        route: 'DELETE /api/youtube/connect',
        userId: user.id,
        operation: 'revoke-integration',
      })
      return databaseErrorResponse('Failed to disconnect YouTube integration')
    }
    
    logInfo('YouTube integration disconnected', {
      route: 'DELETE /api/youtube/connect',
      userId: user.id,
    })
    
    return NextResponse.json({
      success: true,
      message: 'YouTube integration disconnected',
    })
    
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to disconnect YouTube integration')
  }
}
