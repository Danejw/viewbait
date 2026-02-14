/**
 * Unit tests for notifications data layer.
 * Asserts that listNotifications uses a single RPC (get_notifications_with_counts)
 * and returns the correct response shape including unreadCount.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listNotifications } from '@/lib/server/data/notifications'
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

describe('listNotifications', () => {
  let rpcSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    rpcSpy = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls get_notifications_with_counts RPC once with correct params', async () => {
    rpcSpy.mockResolvedValue({
      data: [
        {
          notifications: [mockNotification],
          count: 1,
          unread_count: 2,
        },
      ],
      error: null,
    })

    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient
    await listNotifications(supabase, 'u1', {
      limit: 10,
      offset: 0,
      unreadOnly: false,
      archivedOnly: false,
    })

    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith('get_notifications_with_counts', {
      p_limit: 10,
      p_offset: 0,
      p_unread_only: false,
      p_archived_only: false,
    })
  })

  it('returns notifications, count, and unreadCount from single RPC response', async () => {
    rpcSpy.mockResolvedValue({
      data: [
        {
          notifications: [mockNotification],
          count: 1,
          unread_count: 3,
        },
      ],
      error: null,
    })

    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient
    const result = await listNotifications(supabase, 'u1', {})

    expect(result.error).toBeNull()
    expect(result.notifications).toHaveLength(1)
    expect(result.notifications[0].id).toBe('n1')
    expect(result.count).toBe(1)
    expect(result.unreadCount).toBe(3)
  })

  it('returns 200 shape with empty list and zero counts when RPC returns empty', async () => {
    rpcSpy.mockResolvedValue({
      data: [
        {
          notifications: [],
          count: 0,
          unread_count: 0,
        },
      ],
      error: null,
    })

    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient
    const result = await listNotifications(supabase, 'u1', { limit: 50 })

    expect(result.error).toBeNull()
    expect(result.notifications).toEqual([])
    expect(result.count).toBe(0)
    expect(result.unreadCount).toBe(0)
    expect(rpcSpy).toHaveBeenCalledTimes(1)
  })

  it('passes unreadOnly and archivedOnly to RPC', async () => {
    rpcSpy.mockResolvedValue({
      data: [{ notifications: [], count: 0, unread_count: 0 }],
      error: null,
    })

    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient
    await listNotifications(supabase, 'u1', {
      limit: 20,
      offset: 5,
      unreadOnly: true,
      archivedOnly: true,
    })

    expect(rpcSpy).toHaveBeenCalledWith('get_notifications_with_counts', {
      p_limit: 20,
      p_offset: 5,
      p_unread_only: true,
      p_archived_only: true,
    })
  })

  it('returns error when RPC fails', async () => {
    rpcSpy.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    })

    const supabase = { rpc: rpcSpy } as unknown as SupabaseClient
    const result = await listNotifications(supabase, 'u1', {})

    expect(result.error).not.toBeNull()
    expect(result.notifications).toEqual([])
    expect(result.count).toBe(0)
    expect(result.unreadCount).toBe(0)
  })
})
