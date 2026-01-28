/**
 * Broadcast Notifications API Route
 * 
 * Broadcasts a notification to multiple users (admin/service role only).
 * Accepts user_ids array or audience type for bulk notifications.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
  serverErrorResponse,
  forbiddenResponse,
} from '@/lib/server/utils/error-handler'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { NotificationInsert } from '@/lib/types/database'

/**
 * POST /api/notifications/broadcast
 * Broadcast notification to multiple users (admin only)
 * 
 * Security: Requires admin privileges (is_admin = true in profiles table)
 */
export async function POST(request: Request) {
  try {
    // Require authentication and check admin status
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      logError(profileError || new Error('Profile not found'), {
        route: 'POST /api/notifications/broadcast',
        userId: user.id,
        operation: 'check-admin-status',
      })
      return databaseErrorResponse('Failed to verify admin status')
    }

    if (!profile.is_admin) {
      logError(new Error('Unauthorized broadcast attempt'), {
        route: 'POST /api/notifications/broadcast',
        userId: user.id,
        operation: 'unauthorized-broadcast',
      })
      return forbiddenResponse('Admin privileges required to broadcast notifications')
    }

    // Use service role client for broadcast (admin verified)
    const supabaseService = createServiceClient()

    // Parse request body
    const body = await request.json()
    const { user_ids, audience, notification } = body

    // Validate notification data
    if (!notification) {
      return validationErrorResponse('notification object is required')
    }

    if (!notification.type || !notification.type.trim()) {
      return validationErrorResponse('notification.type is required')
    }

    if (!notification.title || !notification.title.trim()) {
      return validationErrorResponse('notification.title is required')
    }

    if (!notification.body || !notification.body.trim()) {
      return validationErrorResponse('notification.body is required')
    }

    // Validate audience or user_ids
    if (!user_ids && !audience) {
      return validationErrorResponse('Either user_ids or audience is required')
    }

    if (user_ids && !Array.isArray(user_ids)) {
      return validationErrorResponse('user_ids must be an array')
    }

    if (audience && !['all'].includes(audience)) {
      return validationErrorResponse('audience must be "all" (other options not yet implemented)')
    }

    let targetUserIds: string[] = []

    if (user_ids) {
      // Use provided user IDs
      targetUserIds = user_ids
    } else if (audience === 'all') {
      // Get all user IDs from profiles
      const { data: profiles, error: profilesError } = await supabaseService
        .from('profiles')
        .select('id')

      if (profilesError) {
        logError(profilesError, {
          route: 'POST /api/notifications/broadcast',
          operation: 'fetch-all-users',
        })
        return databaseErrorResponse('Failed to fetch users')
      }

      targetUserIds = profiles?.map((p) => p.id) || []
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        errors: [],
      })
    }

    // Prepare notification data (without user_id - added per user in batch)
    const notificationData: Omit<NotificationInsert, 'user_id'> = {
      type: notification.type,
      title: notification.title,
      body: notification.body,
      severity: notification.severity || 'info',
      icon: notification.icon || null,
      action_url: notification.action_url || null,
      action_label: notification.action_label || null,
      metadata: notification.metadata || {},
      is_read: false,
      is_archived: false,
    }

    // Batch insert notifications (Supabase handles batching automatically)
    // Insert in chunks to avoid timeouts
    const BATCH_SIZE = 100
    const batches: string[][] = []
    for (let i = 0; i < targetUserIds.length; i += BATCH_SIZE) {
      batches.push(targetUserIds.slice(i, i + BATCH_SIZE))
    }

    let totalCreated = 0
    const errors: Array<{ user_id: string; error: string }> = []

    for (const batch of batches) {
      const notificationsToInsert = batch.map((user_id) => ({
        ...notificationData,
        user_id,
      }))

      const { data, error: insertError } = await supabaseService
        .from('notifications')
        .insert(notificationsToInsert)
        .select('id')

      if (insertError) {
        logError(insertError, {
          route: 'POST /api/notifications/broadcast',
          operation: 'batch-insert-notifications',
          batchSize: batch.length,
        })
        // Add all users in this batch to errors
        batch.forEach((user_id) => {
          errors.push({
            user_id,
            error: insertError.message,
          })
        })
      } else {
        totalCreated += data?.length || 0
      }
    }

    return NextResponse.json({
      success: true,
      count: totalCreated,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to broadcast notifications')
  }
}
