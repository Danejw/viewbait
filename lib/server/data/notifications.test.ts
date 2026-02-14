/**
 * Unit tests for notifications data layer.
 * Asserts that listNotifications uses RLS-safe table queries (no RPC)
 * and returns the correct response shape including unreadCount.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  archiveNotification,
} from '@/lib/server/data/notifications'
import type { SupabaseClient } from '@supabase/supabase-js'

const mockNotification = {
  id: 'n1',
  user_id: 'u1',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  type: 'info',
  title: 'Test',
  body: 'Body',
  severity: 'info' as const,
  icon: null,
  action_url: null,
  action_label: null,
  metadata: {},
  is_read: false,
  read_at: null,
  is_archived: false,
  archived_at: null,
}

function createListNotificationsSupabaseMock(
  unreadCount: number,
  filteredCount: number,
  filteredData: typeof mockNotification[],
  unreadError: unknown = null,
  filteredError: unknown = null
) {
  const unreadPromise = Promise.resolve({
    count: unreadCount,
    error: unreadError,
    data: null,
  })
  const filteredPromise = Promise.resolve({
    data: filteredData,
    count: filteredCount,
    error: filteredError,
  })
  const chain = {
    select: vi.fn(function (...args: unknown[]) {
      const opts = args[1] as { count?: string; head?: boolean } | undefined
      if (opts?.head === true) {
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue(unreadPromise),
            }),
          }),
        }
      }
      return {
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ range: vi.fn().mockReturnValue(filteredPromise) }),
              range: vi.fn().mockReturnValue(filteredPromise),
            }),
          }),
        }),
      }
    }),
  }
  return {
    from: vi.fn().mockReturnValue(chain),
  }
}

describe('listNotifications', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses table queries and returns notifications, count, and unreadCount', async () => {
    const mock = createListNotificationsSupabaseMock(3, 1, [mockNotification])
    const supabase = { from: mock.from } as unknown as SupabaseClient

    const result = await listNotifications(supabase, 'u1', {
      limit: 10,
      offset: 0,
      unreadOnly: false,
      archivedOnly: false,
    })

    expect(result.error).toBeNull()
    expect(result.notifications).toHaveLength(1)
    expect(result.notifications[0].id).toBe('n1')
    expect(result.count).toBe(1)
    expect(result.unreadCount).toBe(3)
    expect(mock.from).toHaveBeenCalledWith('notifications')
  })

  it('returns empty list and zero counts when no rows', async () => {
    const mock = createListNotificationsSupabaseMock(0, 0, [])
    const supabase = { from: mock.from } as unknown as SupabaseClient

    const result = await listNotifications(supabase, 'u1', { limit: 50 })

    expect(result.error).toBeNull()
    expect(result.notifications).toEqual([])
    expect(result.count).toBe(0)
    expect(result.unreadCount).toBe(0)
  })

  it('returns error when unread count query fails', async () => {
    const mock = createListNotificationsSupabaseMock(0, 0, [], { message: 'DB error' })
    const supabase = { from: mock.from } as unknown as SupabaseClient

    const result = await listNotifications(supabase, 'u1', {})

    expect(result.error).not.toBeNull()
    expect(result.notifications).toEqual([])
    expect(result.count).toBe(0)
    expect(result.unreadCount).toBe(0)
  })

  it('returns error when filtered list query fails', async () => {
    const unreadPromise = Promise.resolve({ count: 0, error: null, data: null })
    const filteredPromise = Promise.resolve({
      data: null,
      count: 0,
      error: { message: 'Filtered query failed' },
    })
    const chain = {
      select: vi.fn(function (...args: unknown[]) {
        const opts = args[1] as { head?: boolean } | undefined
        if (opts?.head === true) {
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue(unreadPromise),
              }),
            }),
          }
        }
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ range: vi.fn().mockReturnValue(filteredPromise) }),
                range: vi.fn().mockReturnValue(filteredPromise),
              }),
            }),
          }),
        }
      }),
    }
    const supabase = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient

    const result = await listNotifications(supabase, 'u1', {})

    expect(result.error).not.toBeNull()
    expect(result.notifications).toEqual([])
    expect(result.count).toBe(0)
    expect(result.unreadCount).toBe(0)
  })
})

describe('markAllNotificationsRead', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses direct UPDATE and returns count of updated rows', async () => {
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: 'a' }, { id: 'b' }],
        error: null,
      }),
    }
    const supabase = {
      from: vi.fn().mockReturnValue(updateChain),
    } as unknown as SupabaseClient

    const result = await markAllNotificationsRead(supabase, 'u1')

    expect(result.error).toBeNull()
    expect(result.count).toBe(2)
    expect(supabase.from).toHaveBeenCalledWith('notifications')
    expect(updateChain.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(updateChain.eq).toHaveBeenCalledWith('is_read', false)
  })
})

describe('markNotificationRead', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses direct UPDATE and returns updated notification', async () => {
    const updated = { ...mockNotification, is_read: true }
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: updated, error: null }),
    }
    const supabase = {
      from: vi.fn().mockReturnValue(updateChain),
    } as unknown as SupabaseClient

    const result = await markNotificationRead(supabase, 'u1', 'n1')

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
    expect(result.data?.id).toBe('n1')
    expect(result.data?.is_read).toBe(true)
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'n1')
    expect(updateChain.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(updateChain.eq).toHaveBeenCalledWith('is_read', false)
  })
})

describe('archiveNotification', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses direct UPDATE and returns archived notification', async () => {
    const archived = { ...mockNotification, is_archived: true }
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: archived, error: null }),
    }
    const supabase = {
      from: vi.fn().mockReturnValue(updateChain),
    } as unknown as SupabaseClient

    const result = await archiveNotification(supabase, 'u1', 'n1')

    expect(result.error).toBeNull()
    expect(result.data).not.toBeNull()
    expect(result.data?.id).toBe('n1')
    expect(result.data?.is_archived).toBe(true)
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'n1')
    expect(updateChain.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(updateChain.eq).toHaveBeenCalledWith('is_archived', false)
  })
})
