/**
 * Tests for useStyles mutation invalidation scoping.
 * Asserts that each mutation invalidates only the query keys it affects.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useStyles } from '@/lib/hooks/useStyles'

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1' } })),
}))

vi.mock('@/lib/services/styles', () => ({
  getStyles: vi.fn().mockResolvedValue({ styles: [], error: null }),
  createStyle: vi.fn().mockResolvedValue({ style: { id: 's1' }, error: null }),
  updateStyle: vi.fn().mockResolvedValue({ style: { id: 's1' }, error: null }),
  deleteStyle: vi.fn().mockResolvedValue(true),
  toggleStylePublic: vi.fn().mockResolvedValue({ isPublic: true }),
  addStyleReferenceImages: vi.fn().mockResolvedValue({ error: null }),
  removeStyleReferenceImage: vi.fn().mockResolvedValue({ error: null }),
  updateStylePreview: vi.fn().mockResolvedValue({ error: null }),
  getPublicStyles: vi.fn().mockResolvedValue({ styles: [], error: null }),
}))

vi.mock('@/lib/services/favorites', () => ({
  getFavoriteIds: vi.fn().mockResolvedValue({ ids: new Set<string>() }),
  toggleFavorite: vi.fn().mockResolvedValue({ favorited: true }),
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function getInvalidatedKeys(invalidateSpy: ReturnType<typeof vi.fn>) {
  return invalidateSpy.mock.calls.map((call) => call[0]?.queryKey?.slice(0, 3).join(','))
}

describe('useStyles invalidation scoping', () => {
  let queryClient: QueryClient
  let invalidateSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  })

  afterEach(() => {
    invalidateSpy.mockRestore()
    vi.clearAllMocks()
  })

  it('toggleFavorite invalidates only favorites key', async () => {
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => useStyles({ autoFetch: true }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.toggleFavorite).toBeDefined()
    })

    invalidateSpy.mockClear()

    await act(async () => {
      await result.current.toggleFavorite('style-id-1')
    })

    const keys = getInvalidatedKeys(invalidateSpy)
    expect(keys).toContain('favorites,user-1,style')
    expect(keys).not.toContain('styles,user-1')
    expect(keys).not.toContain('styles,public')
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })

  it('updateStyle invalidates only styles list key', async () => {
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => useStyles({ autoFetch: true }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.updateStyle).toBeDefined()
    })

    invalidateSpy.mockClear()

    await act(async () => {
      await result.current.updateStyle('style-id-1', { name: 'Updated' })
    })

    const keys = getInvalidatedKeys(invalidateSpy)
    expect(keys).toContain('styles,user-1')
    expect(keys).not.toContain('styles,public')
    expect(keys).not.toContain('favorites,user-1,style')
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })

  it('togglePublic invalidates styles list and public list only', async () => {
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => useStyles({ autoFetch: true }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.togglePublic).toBeDefined()
    })

    invalidateSpy.mockClear()

    await act(async () => {
      await result.current.togglePublic('style-id-1')
    })

    const keys = getInvalidatedKeys(invalidateSpy)
    expect(keys).toContain('styles,user-1')
    expect(keys).toContain('styles,public')
    expect(keys).not.toContain('favorites,user-1,style')
    expect(invalidateSpy).toHaveBeenCalledTimes(2)
  })
})
