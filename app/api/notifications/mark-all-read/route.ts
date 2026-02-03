/**
 * Mark All Notifications Read API Route
 * 
 * Marks all unread notifications as read for the authenticated user.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { databaseErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for the authenticated user
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Use RPC function to mark all as read
    const { data: count, error } = await supabase.rpc('rpc_mark_all_notifications_read')

    if (error) {
      logError(error, {
        route: 'POST /api/notifications/mark-all-read',
        userId: user.id,
        operation: 'mark-all-notifications-read',
      })
      return databaseErrorResponse('Failed to mark all notifications as read')
    }

    return NextResponse.json({
      success: true,
      count: count || 0,
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/notifications/mark-all-read', 'mark-all-notifications-read', undefined, 'Failed to mark all notifications as read')
  }
}
