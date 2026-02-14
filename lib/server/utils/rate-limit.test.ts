/**
 * Unit tests for rate limiter: checkRateLimit and enforceRateLimit.
 */

import { describe, expect, it } from 'vitest'
import {
  checkRateLimit,
  enforceRateLimit,
  RATE_LIMIT_CONFIG,
} from '@/lib/server/utils/rate-limit'

describe('rate-limit', () => {
  describe('checkRateLimit', () => {
    it('allows requests up to limitPerWindow then returns false', () => {
      const key = `test-check-${Date.now()}-${Math.random()}`
      const limit = 2

      expect(checkRateLimit(key, limit)).toBe(true)
      expect(checkRateLimit(key, limit)).toBe(true)
      expect(checkRateLimit(key, limit)).toBe(false)
    })

    it('allows a different key after one key is exhausted', () => {
      const key1 = `test-key1-${Date.now()}-${Math.random()}`
      const key2 = `test-key2-${Date.now()}-${Math.random()}`
      const limit = 1

      expect(checkRateLimit(key1, limit)).toBe(true)
      expect(checkRateLimit(key1, limit)).toBe(false)
      expect(checkRateLimit(key2, limit)).toBe(true)
    })
  })

  describe('enforceRateLimit', () => {
    it('returns null up to limitPerWindow then returns 429 response', async () => {
      const userId = `test-user-${Date.now()}-${Math.random()}`
      const request = new Request('https://example.com')
      const routeId = 'account-export'
      const limit = RATE_LIMIT_CONFIG[routeId].limitPerWindow
      const message = RATE_LIMIT_CONFIG[routeId].message

      for (let i = 0; i < limit; i++) {
        const res = enforceRateLimit(routeId, request, userId)
        expect(res).toBeNull()
      }

      const rateLimited = enforceRateLimit(routeId, request, userId)
      expect(rateLimited).not.toBeNull()
      expect(rateLimited!.status).toBe(429)
      const body = await rateLimited!.json() as { error?: string; code?: string }
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(body.error).toBe(message)
    })

    it('uses route-specific message in 429 response', async () => {
      const userId = `test-user-msg-${Date.now()}-${Math.random()}`
      const request = new Request('https://example.com')
      const routeId = 'generate'
      const limit = RATE_LIMIT_CONFIG[routeId].limitPerWindow

      for (let i = 0; i < limit; i++) {
        enforceRateLimit(routeId, request, userId)
      }
      const res = enforceRateLimit(routeId, request, userId)
      expect(res).not.toBeNull()
      const body = await res!.json() as { error?: string }
      expect(body.error).toContain('generation')
    })
  })
})
