/**
 * Server-Side Notifications Data Fetching
 * 
 * Fetches notification data server-side for SSR.
 * Reuses logic from app/api/notifications/route.ts
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import type { Notification, NotificationInsert } from '@/lib/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FetchNotificationsOptions {
  limit?: number
  offset?: number
  unreadOnly?: boolean
  archivedOnly?: boolean
}

export interface FetchNotificationsResult {
  notifications: Notification[]
  count: number
  unreadCount: number
  error: Error | null
}

export interface CreateNotificationResult {
  data: Notification | null
  error: Error | null
  isValidationError: boolean
}

const VALID_SEVERITIES = ['info', 'success', 'warning', 'error'] as const
const VALID_TYPES = ['system', 'billing', 'reward', 'social', 'info', 'warning'] as const

function validationError(message: string): CreateNotificationResult {
  return {
    data: null,
    error: new Error(message),
    isValidationError: true,
  }
}

/**
 * Core notifications query used by API routes and server wrappers.
 * Uses a single RPC to return list, count, and unread count in one round-trip.
 * Requires an authenticated Supabase client (auth.uid() used in RPC).
 */
export async function listNotifications(
  supabase: SupabaseClient,
  userId: string,
  options: FetchNotificationsOptions = {}
): Promise<FetchNotificationsResult> {
  const {
    limit = 10,
    offset = 0,
    unreadOnly = false,
    archivedOnly = false,
  } = options

  const { data: rpcData, error } = await supabase.rpc('get_notifications_with_counts', {
    p_limit: limit,
    p_offset: offset,
    p_unread_only: unreadOnly,
    p_archived_only: archivedOnly,
  })

  if (error) {
    return {
      notifications: [],
      count: 0,
      unreadCount: 0,
      error: error as Error,
    }
  }

  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
  if (!row || typeof row !== 'object') {
    return {
      notifications: [],
      count: 0,
      unreadCount: 0,
      error: null,
    }
  }

  const notifications = (row.notifications as Notification[]) ?? []
  const count = typeof row.count === 'number' ? row.count : Number(row.count) || 0
  const unreadCount = typeof row.unread_count === 'number' ? row.unread_count : Number(row.unread_count) || 0

  return {
    notifications: Array.isArray(notifications) ? notifications : [],
    count,
    unreadCount,
    error: null,
  }
}

/**
 * Lightweight unread count query for a user.
 */
export async function getUnreadCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .eq('is_archived', false)

  return count || 0
}

/**
 * Get one notification by id scoped to user.
 */
export async function getNotificationById(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<{ data: Notification | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return { data: null, error: error as Error }
  }

  return { data: (data as Notification | null) ?? null, error: null }
}

/**
 * Mark all notifications as read for authenticated user context.
 * Requires session client with authenticated user.
 */
export async function markAllNotificationsRead(
  supabase: SupabaseClient
): Promise<{ count: number; error: Error | null }> {
  const { data: count, error } = await supabase.rpc('rpc_mark_all_notifications_read')
  if (error) {
    return { count: 0, error: error as Error }
  }
  return { count: (count as number | null) || 0, error: null }
}

/**
 * Mark one notification as read using RPC.
 * Requires session client with authenticated user.
 */
export async function markNotificationRead(
  supabase: SupabaseClient,
  notificationId: string
): Promise<{ data: Notification | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('rpc_mark_notification_read', {
    notification_id: notificationId,
  })

  if (error) {
    return { data: null, error: error as Error }
  }

  return { data: (data as Notification | null) ?? null, error: null }
}

/**
 * Archive one notification using RPC.
 * Requires session client with authenticated user.
 */
export async function archiveNotification(
  supabase: SupabaseClient,
  notificationId: string
): Promise<{ data: Notification | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('rpc_archive_notification', {
    notification_id: notificationId,
  })

  if (error) {
    return { data: null, error: error as Error }
  }

  return { data: (data as Notification | null) ?? null, error: null }
}

/**
 * Create a notification row.
 * Caller must use a service-role client for server-only creation, since RLS
 * prevents arbitrary writes to other users' notifications from a session client.
 */
export async function createNotification(
  supabase: SupabaseClient,
  body: NotificationInsert
): Promise<CreateNotificationResult> {
  if (!body.user_id || !body.user_id.trim()) {
    return validationError('user_id is required')
  }

  if (!body.type || !body.type.trim()) {
    return validationError('type is required')
  }

  if (!body.title || !body.title.trim()) {
    return validationError('title is required')
  }

  if (!body.body || !body.body.trim()) {
    return validationError('body is required')
  }

  if (body.severity && !VALID_SEVERITIES.includes(body.severity)) {
    return validationError(`severity must be one of: ${VALID_SEVERITIES.join(', ')}`)
  }

  if (!VALID_TYPES.includes(body.type as (typeof VALID_TYPES)[number])) {
    return validationError(`type must be one of: ${VALID_TYPES.join(', ')}`)
  }

  const { data: userExists, error: userCheckError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', body.user_id)
    .single()

  if (userCheckError || !userExists) {
    return validationError('User not found')
  }

  const notificationData: NotificationInsert = {
    ...body,
    severity: body.severity || 'info',
    metadata: body.metadata || {},
    is_read: false,
    is_archived: false,
  }

  const { data: notification, error } = await supabase
    .from('notifications')
    .insert(notificationData)
    .select()
    .single()

  if (error) {
    return {
      data: null,
      error: error as Error,
      isValidationError: false,
    }
  }

  return {
    data: notification as Notification,
    error: null,
    isValidationError: false,
  }
}

/**
 * Fetch notifications for the authenticated user
 */
export async function fetchNotifications(
  options: FetchNotificationsOptions = {}
): Promise<FetchNotificationsResult> {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    return listNotifications(supabase, user.id, options)
  } catch (error) {
    return {
      notifications: [],
      count: 0,
      unreadCount: 0,
      error: error instanceof Error ? error : new Error('Failed to fetch notifications'),
    }
  }
}

/**
 * Fetch unread count for the authenticated user (lightweight)
 */
export async function fetchUnreadCount(): Promise<number> {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    return getUnreadCount(supabase, user.id)
  } catch (error) {
    return 0
  }
}
