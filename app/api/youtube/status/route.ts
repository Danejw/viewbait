/**
 * YouTube Status API Route
 * 
 * Returns the YouTube integration status for the authenticated user.
 * This is a safe endpoint that only exposes non-sensitive information.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

// Cache responses for 1 minute
export const revalidate = 60

/**
 * GET /api/youtube/status
 * Returns YouTube integration status for the authenticated user
 * 
 * Safe fields only - no tokens exposed
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    
    // Fetch integration status (uses RLS - only sees own data)
    const { data: integration, error: fetchError } = await supabase
      .from('youtube_integrations')
      .select('google_user_id, is_connected, scopes_granted, created_at, updated_at, revoked_at')
      .eq('user_id', user.id)
      .single()
    
    if (fetchError) {
      // No integration record - user has never connected
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          status: {
            isConnected: false,
            hasEverConnected: false,
            googleUserId: null,
            scopesGranted: [],
            connectedAt: null,
            revokedAt: null,
          },
        })
      }
      
      logError(fetchError, {
        route: 'GET /api/youtube/status',
        userId: user.id,
        operation: 'fetch-integration-status',
      })
      return databaseErrorResponse('Failed to fetch integration status')
    }
    
    // Also fetch channel info if connected
    let channelInfo = null
    if (integration.is_connected) {
      const { data: channel } = await supabase
        .from('youtube_channels')
        .select('channel_id, title, custom_url, thumbnail_url, subscriber_count, video_count')
        .eq('user_id', user.id)
        .single()
      
      if (channel) {
        channelInfo = {
          channelId: channel.channel_id,
          title: channel.title,
          customUrl: channel.custom_url,
          thumbnailUrl: channel.thumbnail_url,
          subscriberCount: channel.subscriber_count,
          videoCount: channel.video_count,
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      status: {
        isConnected: integration.is_connected,
        hasEverConnected: true,
        googleUserId: integration.google_user_id,
        scopesGranted: integration.scopes_granted || [],
        connectedAt: integration.created_at,
        lastUpdated: integration.updated_at,
        revokedAt: integration.revoked_at,
      },
      channel: channelInfo,
    })
    
  } catch (error) {
    return handleApiError(error, 'UNKNOWN', 'fetch-integration-status', undefined, 'Failed to fetch integration status')
  }
}
