/**
 * Unit tests for analytics session ID (getOrCreateSessionId).
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { getOrCreateSessionId } from '@/lib/analytics/session'

describe('analytics session', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    })
  })

  it('returns new session id when storage is empty', () => {
    const sid = getOrCreateSessionId()
    expect(typeof sid).toBe('string')
    expect(sid.length).toBeGreaterThanOrEqual(10)
    expect(storage.get('vb_sid')).toBe(sid)
  })

  it('returns existing session id when storage has value', () => {
    storage.set('vb_sid', 'existing-session-123')
    const sid = getOrCreateSessionId()
    expect(sid).toBe('existing-session-123')
  })

  it('persists new id when storage had short value', () => {
    storage.set('vb_sid', 'x')
    const sid = getOrCreateSessionId()
    expect(sid).not.toBe('x')
    expect(sid.length).toBeGreaterThanOrEqual(10)
  })
})
