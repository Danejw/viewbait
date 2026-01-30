/**
 * Notifications API Route
 * 
 * Handles GET (list) and POST (create) operations for notifications.
 * POST requires service role for security (server-side only).
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { createCachedResponse } from '@/lib/server/utils/cache-headers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { NotificationInsert } from '@/lib/types/database'

// Cache GET responses for 30 seconds (ISR)
export const revalidate = 30

/**
 * GET /api/notifications
 * List notifications for the authenticated user
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const archivedOnly = searchParams.get('archivedOnly') === 'true'

    // Build query
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (archivedOnly) {
      query = query.eq('is_archived', true)
    } else {
      // Default: exclude archived
      query = query.eq('is_archived', false)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      logError(error, {
        route: 'GET /api/notifications',
        userId: user.id,
        operation: 'fetch-notifications',
      })
      return databaseErrorResponse('Failed to fetch notifications')
    }

    // Get unread count separately (lightweight query)
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('is_archived', false)

    const responseData = {
      notifications: data || [],
      count: count || 0,
      unreadCount: unreadCount || 0,
    }

    // Cache as private dynamic data (notifications change frequently)
    return createCachedResponse(
      responseData,
      { strategy: 'private-dynamic', maxAge: 120 },
      request
    )
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to fetch notifications')
  }
}

/**
 * POST /api/notifications
 * Create a notification (server-side only).
 * Requires x-internal-secret header matching INTERNAL_API_SECRET. Rejects client requests.
 */
export async function POST(request: Request) {
  try {
    const internalSecret = request.headers.get('x-internal-secret')
    const expectedSecret = process.env.INTERNAL_API_SECRET

    if (!expectedSecret) {
      logError(new Error('INTERNAL_API_SECRET not configured'), {
        route: 'POST /api/notifications',
        operation: 'create-notification-auth',
      })
      return NextResponse.json({ error: 'Not configured' }, { status: 500 })
    }

    if (!internalSecret || internalSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabaseService = createServiceClient()

    const body: NotificationInsert = await request.json()

    // Validate required fields
    if (!body.user_id || !body.user_id.trim()) {
      return validationErrorResponse('user_id is required')
    }

    if (!body.type || !body.type.trim()) {
      return validationErrorResponse('type is required')
    }

    if (!body.title || !body.title.trim()) {
      return validationErrorResponse('title is required')
    }

    if (!body.body || !body.body.trim()) {
      return validationErrorResponse('body is required')
    }

    // Validate severity
    const validSeverities = ['info', 'success', 'warning', 'error']
    if (body.severity && !validSeverities.includes(body.severity)) {
      return validationErrorResponse(`severity must be one of: ${validSeverities.join(', ')}`)
    }

    // Validate type
    const validTypes = ['system', 'billing', 'reward', 'social', 'info', 'warning']
    if (!validTypes.includes(body.type)) {
      return validationErrorResponse(`type must be one of: ${validTypes.join(', ')}`)
    }

    // Verify user exists
    const { data: userExists, error: userCheckError } = await supabaseService
      .from('profiles')
      .select('id')
      .eq('id', body.user_id)
      .single()

    if (userCheckError || !userExists) {
      return validationErrorResponse('User not found')
    }

    // Set defaults
    const notificationData: NotificationInsert = {
      ...body,
      severity: body.severity || 'info',
      metadata: body.metadata || {},
      is_read: false,
      is_archived: false,
    }

    // Create notification
    const { data: notification, error: insertError } = await supabaseService
      .from('notifications')
      .insert(notificationData)
      .select()
      .single()

    if (insertError) {
      logError(insertError, {
        route: 'POST /api/notifications',
        userId: body.user_id,
        operation: 'create-notification',
      })
      return databaseErrorResponse('Failed to create notification')
    }

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to create notification')
  }
}
