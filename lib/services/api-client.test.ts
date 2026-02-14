/**
 * Unit tests for API client: timeout and retry behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet, apiPost } from '@/lib/services/api-client'

describe('api-client', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    vi.useRealTimers()
  })

  describe('timeout', () => {
    it('returns TIMEOUT error when fetch is aborted (AbortError)', async () => {
      fetchSpy.mockRejectedValue(new DOMException('Aborted', 'AbortError'))

      const result = await apiGet<{ ok: boolean }>('/api/test', {}, { timeoutMs: 30_000 })

      expect(result.error).not.toBeNull()
      expect(result.error?.code).toBe('TIMEOUT')
      expect(result.error?.message).toMatch(/timeout/i)
      expect(result.data).toBeNull()
    })

    it('passes AbortSignal to fetch when timeoutMs is set', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )

      await apiGet<{ ok: boolean }>('/api/test', {}, { timeoutMs: 5_000 })

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it('clears timeout when request completes in time', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ data: 1 }), { status: 200 })
      )

      const result = await apiGet<{ data: number }>('/api/test', {}, { timeoutMs: 30_000 })

      expect(result.error).toBeNull()
      expect(result.data).toEqual({ data: 1 })
    })
  })

  describe('retry (GET only)', () => {
    it('retries on 5xx and returns success on second call', async () => {
      vi.useFakeTimers()
      fetchSpy
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Server error' }), { status: 503 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 })
        )

      const p = apiGet<{ ok: boolean }>('/api/test', {}, { retry: true })
      await vi.advanceTimersByTimeAsync(1_000)
      await vi.advanceTimersByTimeAsync(2_000)

      const result = await p

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(result.error).toBeNull()
      expect(result.data).toEqual({ ok: true })
    })

    it('does not retry on 4xx', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 })
      )

      const result = await apiGet<unknown>('/api/test', {}, { retry: true })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(result.error).not.toBeNull()
      expect(result.error?.status).toBe(400)
      expect(result.data).toBeNull()
    })

    it('retries on network error and returns success on second call', async () => {
      vi.useFakeTimers()
      fetchSpy
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ok: true }), { status: 200 })
        )

      const p = apiGet<{ ok: boolean }>('/api/test', {}, { retry: true })
      await vi.advanceTimersByTimeAsync(1_000)
      await vi.advanceTimersByTimeAsync(2_000)

      const result = await p

      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(result.error).toBeNull()
      expect(result.data).toEqual({ ok: true })
    })
  })

  describe('POST has no retry', () => {
    it('does not retry on 5xx', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Server error' }), { status: 503 })
      )

      const result = await apiPost<unknown>('/api/test', { x: 1 })

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(result.error).not.toBeNull()
      expect(result.error?.status).toBe(503)
    })
  })
})
