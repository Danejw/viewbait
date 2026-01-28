/**
 * Notification by ID API Route
 * 
 * Handles PATCH operations for a specific notification.
 * Uses RPC functions for safe updates (mark read/archive).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

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
