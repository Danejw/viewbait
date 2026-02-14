/**
 * Tests for useExperimentAnalytics.
 * Validates visibility-aware polling: refetch when tab visible, pause when hidden.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useExperimentAnalytics } from '@/lib/hooks/useExperimentAnalytics'

vi.mock('@/lib/services/experiments', () => ({
  syncAnalytics: vi.fn(),
}))

import * as experimentsService from '@/lib/services/experiments'

const syncAnalyticsSpy = vi.mocked(experimentsService.syncAnalytics)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function setDocumentVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value,
    configurable: true,
    writable: true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

const POLL_INTERVAL_MS = 5 * 60 * 1000

describe('useExperimentAnalytics', () => {
  beforeEach(() => {
    syncAnalyticsSpy.mockReset()
    syncAnalyticsSpy.mockResolvedValue({ synced: true } as never)
    setDocumentVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls at interval when tab is visible', async () => {
    vi.useFakeTimers()
    const wrapper = createWrapper()
    renderHook(
      () =>
        useExperimentAnalytics({
          videoId: 'v1',
          enabled: true,
          refetchInterval: POLL_INTERVAL_MS,
        }),
      { wrapper }
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
    })
    expect(syncAnalyticsSpy).toHaveBeenCalledTimes(1)
    expect(syncAnalyticsSpy).toHaveBeenCalledWith(['v1'])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(syncAnalyticsSpy).toHaveBeenCalledTimes(2)
  })

  it('stops polling when tab is hidden', async () => {
    vi.useFakeTimers()
    const wrapper = createWrapper()
    renderHook(
      () =>
        useExperimentAnalytics({
          videoId: 'v1',
          enabled: true,
          refetchInterval: POLL_INTERVAL_MS,
        }),
      { wrapper }
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
    })
    expect(syncAnalyticsSpy).toHaveBeenCalledTimes(1)

    await act(() => {
      setDocumentVisibility('hidden')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
      await Promise.resolve()
    })
    expect(syncAnalyticsSpy).toHaveBeenCalledTimes(1)
  })

  it('resumes polling when tab becomes visible again', async () => {
    vi.useFakeTimers()
    const wrapper = createWrapper()
    renderHook(
      () =>
        useExperimentAnalytics({
          videoId: 'v1',
          enabled: true,
          refetchInterval: POLL_INTERVAL_MS,
        }),
      { wrapper }
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
    })
    expect(syncAnalyticsSpy).toHaveBeenCalledTimes(1)

    await act(() => setDocumentVisibility('hidden'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
      await Promise.resolve()
    })
    expect(syncAnalyticsSpy).toHaveBeenCalledTimes(1)

    syncAnalyticsSpy.mockClear()
    await act(() => setDocumentVisibility('visible'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      await Promise.resolve()
    })
    expect(syncAnalyticsSpy.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('does not run query when enabled is false', async () => {
    const wrapper = createWrapper()
    renderHook(
      () =>
        useExperimentAnalytics({
          videoId: 'v1',
          enabled: false,
        }),
      { wrapper }
    )
    await waitFor(() => {})
    expect(syncAnalyticsSpy).not.toHaveBeenCalled()
  })
})
