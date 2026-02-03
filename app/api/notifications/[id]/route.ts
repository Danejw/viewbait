/**
 * Notification by ID API Route
 *
 * GET: Fetch a single notification (auth: user's own only).
 * PATCH: Update a notification (mark as read or archive). Uses RPC functions.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

/**
 * GET /api/notifications/[id]
 * Fetch a single notification for the authenticated user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    const { data: notification, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      logError(error, {
        route: 'GET /api/notifications/[id]',
        userId: user.id,
        operation: 'get-notification',
        notificationId: id,
      })
      return databaseErrorResponse('Failed to fetch notification')
    }

    if (!notification) {
      return notFoundResponse('Notification not found')
    }

    return NextResponse.json({ notification })
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    return handleApiError(
      error,
      'GET /api/notifications/[id]',
      'get-notification',
      undefined,
      'Failed to fetch notification'
    )
  }
}

/**
 * PATCH /api/notifications/[id]
 * Update a notification (mark as read or archive)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    const { id } = await params

    // Parse request body
    const body = await request.json()
    const { action } = body

    // Validate action
    if (!action || !['read', 'archive'].includes(action)) {
      return validationErrorResponse('action must be "read" or "archive"')
    }

    let result

    if (action === 'read') {
      // Use RPC function to mark as read
      const { data, error } = await supabase.rpc('rpc_mark_notification_read', {
        notification_id: id,
      })

      if (error) {
        logError(error, {
          route: 'PATCH /api/notifications/[id]',
          userId: user.id,
          operation: 'mark-notification-read',
          notificationId: id,
        })
        return databaseErrorResponse('Failed to mark notification as read')
      }

      result = data
    } else if (action === 'archive') {
      // Use RPC function to archive
      const { data, error } = await supabase.rpc('rpc_archive_notification', {
        notification_id: id,
      })

      if (error) {
        logError(error, {
          route: 'PATCH /api/notifications/[id]',
          userId: user.id,
          operation: 'archive-notification',
          notificationId: id,
        })
        return databaseErrorResponse('Failed to archive notification')
      }

      result = data
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Notification not found or already processed', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    return NextResponse.json({ notification: result })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to update notification')
  }
}
