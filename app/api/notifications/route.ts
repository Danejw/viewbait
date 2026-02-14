/**
 * Notifications API Route
 * 
 * Handles GET (list) and POST (create) operations for notifications.
 * POST requires service role for security (server-side only).
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import {
  validationErrorResponse,
  databaseErrorResponse,
} from '@/lib/server/utils/error-handler'
import { createCachedResponse } from '@/lib/server/utils/cache-headers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { NotificationInsert } from '@/lib/types/database'
import { listNotifications, createNotification } from '@/lib/server/data/notifications'

// Cache GET responses for 30 seconds (ISR)
export const revalidate = 30

const NOTIFICATIONS_MAX_LIMIT = 100

/**
 * Parse and validate notifications list query params. Returns null and sets response if invalid.
 */
function parseNotificationsQuery(
  request: Request
): { limit: number; offset: number; unreadOnly: boolean; archivedOnly: boolean } | { error: NextResponse } {
  const { searchParams } = new URL(request.url)

  const limitParam = searchParams.get('limit')
  const defaultLimit = 10
  let limit = defaultLimit
  if (limitParam !== null && limitParam !== '') {
    const parsed = parseInt(limitParam, 10)
    if (Number.isNaN(parsed) || parsed < 1 || parsed > NOTIFICATIONS_MAX_LIMIT) {
      return {
        error: NextResponse.json(
          { error: `limit must be an integer between 1 and ${NOTIFICATIONS_MAX_LIMIT}` },
          { status: 400 }
        ),
      }
    }
    limit = Math.min(parsed, NOTIFICATIONS_MAX_LIMIT)
  }

  const offsetParam = searchParams.get('offset')
  let offset = 0
  if (offsetParam !== null && offsetParam !== '') {
    const parsed = parseInt(offsetParam, 10)
    if (Number.isNaN(parsed) || parsed < 0) {
      return {
        error: NextResponse.json(
          { error: 'offset must be a non-negative integer' },
          { status: 400 }
        ),
      }
    }
    offset = Math.max(0, parsed)
  }

  const unreadOnly = searchParams.get('unreadOnly') === 'true'
  const archivedOnly = searchParams.get('archivedOnly') === 'true'

  return { limit, offset, unreadOnly, archivedOnly }
}

/**
 * GET /api/notifications
 * List notifications for the authenticated user
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const parsed = parseNotificationsQuery(request)
    if ('error' in parsed) {
      return parsed.error
    }
    const { limit, offset, unreadOnly, archivedOnly } = parsed

    const { notifications, count, unreadCount, error } = await listNotifications(supabase, user.id, {
      limit,
      offset,
      unreadOnly,
      archivedOnly,
    })

    if (error) {
      logError(error, {
        route: 'GET /api/notifications',
        userId: user.id,
        operation: 'fetch-notifications',
      })
      return databaseErrorResponse('Failed to fetch notifications')
    }

    const responseData = {
      notifications,
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
    return handleApiError(error, 'GET /api/notifications', 'fetch-notifications', undefined, 'Failed to fetch notifications')
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
    const { data: notification, error, isValidationError } = await createNotification(supabaseService, body)

    if (error) {
      if (isValidationError) {
        return validationErrorResponse(error.message)
      }
      logError(error, {
        route: 'POST /api/notifications',
        userId: body.user_id,
        operation: 'create-notification',
      })
      return databaseErrorResponse('Failed to create notification')
    }

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'POST /api/notifications', 'create-notification', undefined, 'Failed to create notification')
  }
}
