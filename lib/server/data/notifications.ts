/**
 * Server-Side Notifications Data Fetching
 * 
 * Fetches notification data server-side for SSR.
 * Reuses logic from app/api/notifications/route.ts
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import type { Notification } from '@/lib/types/database'

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

/**
 * Fetch notifications for the authenticated user
 */
export async function fetchNotifications(
  options: FetchNotificationsOptions = {}
): Promise<FetchNotificationsResult> {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const {
      limit = 50,
      offset = 0,
      unreadOnly = false,
      archivedOnly = false,
    } = options

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
      return {
        notifications: [],
        count: 0,
        unreadCount: 0,
        error: error as Error,
      }
    }

    // Get unread count separately (lightweight query)
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('is_archived', false)

    return {
      notifications: (data as Notification[]) || [],
      count: count || 0,
      unreadCount: unreadCount || 0,
      error: null,
    }
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

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('is_archived', false)

    return count || 0
  } catch (error) {
    return 0
  }
}
