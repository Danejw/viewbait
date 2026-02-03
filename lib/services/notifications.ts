/**
 * Notifications Service
 * 
 * Handles all notification operations via secure API routes.
 * All database operations are server-side only.
 */

import type { Notification } from '@/lib/types/database'

export interface NotificationsQueryOptions {
  limit?: number
  offset?: number
  unreadOnly?: boolean
  archivedOnly?: boolean
}

/**
 * Get notifications for the authenticated user with pagination
 */
export async function getNotifications(
  options: NotificationsQueryOptions = {}
): Promise<{
  notifications: Notification[]
  count: number
  unreadCount: number
  error: Error | null
}> {
  const {
    limit = 50,
    offset = 0,
    unreadOnly = false,
    archivedOnly = false,
  } = options

  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      ...(unreadOnly && { unreadOnly: 'true' }),
      ...(archivedOnly && { archivedOnly: 'true' }),
    })

    const response = await fetch(`/api/notifications?${params.toString()}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        notifications: [],
        count: 0,
        unreadCount: 0,
        error: new Error(errorData.error || 'Failed to fetch notifications'),
      }
    }

    const data = await response.json()
    return {
      notifications: data.notifications || [],
      count: data.count || 0,
      unreadCount: data.unreadCount || 0,
      error: null,
    }
  } catch (error) {
    return {
      notifications: [],
      count: 0,
      unreadCount: 0,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get a single notification by id (for Updates view / deep link).
 */
export async function getNotificationById(
  notificationId: string
): Promise<{
  notification: Notification | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/notifications/${notificationId}`)

    if (!response.ok) {
      if (response.status === 404) {
        return { notification: null, error: null }
      }
      const errorData = await response.json()
      return {
        notification: null,
        error: new Error(errorData.error || 'Failed to fetch notification'),
      }
    }

    const data = await response.json()
    return {
      notification: data.notification || null,
      error: null,
    }
  } catch (error) {
    return {
      notification: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<{
  notification: Notification | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'read' }),
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        notification: null,
        error: new Error(errorData.error || 'Failed to mark notification as read'),
      }
    }

    const data = await response.json()
    return {
      notification: data.notification || null,
      error: null,
    }
  } catch (error) {
    return {
      notification: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Archive a notification
 */
export async function archiveNotification(
  notificationId: string
): Promise<{
  notification: Notification | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'archive' }),
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        notification: null,
        error: new Error(errorData.error || 'Failed to archive notification'),
      }
    }

    const data = await response.json()
    return {
      notification: data.notification || null,
      error: null,
    }
  } catch (error) {
    return {
      notification: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<{
  success: boolean
  count: number
  error: Error | null
}> {
  try {
    const response = await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        count: 0,
        error: new Error(errorData.error || 'Failed to mark all notifications as read'),
      }
    }

    const data = await response.json()
    return {
      success: data.success || false,
      count: data.count || 0,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}
