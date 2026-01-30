/**
 * Server-Only Notification Creation
 *
 * Only the backend should create notifications. This module uses the service role
 * client to insert into the notifications table. Do not use from client code.
 *
 * Use createNotification() for one-off notifications (e.g. referral rewarded).
 * Use createNotificationIfNew() for milestone notifications to avoid duplicates.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { logError } from '@/lib/server/utils/logger'
import type { NotificationInsert } from '@/lib/types/database'

const VALID_TYPES = ['system', 'billing', 'reward', 'social', 'info', 'warning'] as const
const VALID_SEVERITIES = ['info', 'success', 'warning', 'error'] as const

export interface CreateNotificationResult {
  data: { id: string } | null
  error: Error | null
}

/**
 * Create a single notification. Call only from server-side code (API routes, server actions, services).
 * Uses service role to bypass RLS.
 */
export async function createNotification(
  insert: NotificationInsert
): Promise<CreateNotificationResult> {
  try {
    const supabase = createServiceClient()

    if (!insert.user_id?.trim()) {
      return { data: null, error: new Error('user_id is required') }
    }
    if (!insert.type?.trim() || !VALID_TYPES.includes(insert.type as (typeof VALID_TYPES)[number])) {
      return { data: null, error: new Error(`type must be one of: ${VALID_TYPES.join(', ')}`) }
    }
    if (!insert.title?.trim()) {
      return { data: null, error: new Error('title is required') }
    }
    if (!insert.body?.trim()) {
      return { data: null, error: new Error('body is required') }
    }
    if (insert.severity && !VALID_SEVERITIES.includes(insert.severity)) {
      return { data: null, error: new Error(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`) }
    }

    const payload: NotificationInsert = {
      ...insert,
      severity: insert.severity ?? 'info',
      metadata: insert.metadata ?? {},
      is_read: false,
      is_archived: false,
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert(payload)
      .select('id')
      .single()

    if (error) {
      logError(error, {
        module: 'lib/server/notifications/create',
        operation: 'create-notification',
        userId: insert.user_id,
      })
      return { data: null, error: error as Error }
    }

    return { data: data as { id: string }, error: null }
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Failed to create notification')
    logError(error, {
      module: 'lib/server/notifications/create',
      operation: 'create-notification',
    })
    return { data: null, error }
  }
}

/**
 * Create a milestone notification only if one with the same milestone key does not already exist for the user.
 * Use for "first project", "first thumbnail", "5 projects", etc., to avoid duplicate notifications.
 */
export async function createNotificationIfNew(
  userId: string,
  milestoneKey: string,
  payload: Omit<NotificationInsert, 'user_id' | 'metadata' | 'is_read' | 'is_archived'>
): Promise<CreateNotificationResult> {
  try {
    const supabase = createServiceClient()

    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('metadata->>milestone', milestoneKey)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return { data: { id: existing.id }, error: null }
    }

    return createNotification({
      ...payload,
      user_id: userId,
      metadata: { milestone: milestoneKey },
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Failed to create milestone notification')
    logError(error, {
      module: 'lib/server/notifications/create',
      operation: 'create-notification-if-new',
      userId,
      milestoneKey,
    })
    return { data: null, error }
  }
}
