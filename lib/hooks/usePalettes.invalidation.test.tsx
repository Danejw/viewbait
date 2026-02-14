/**
 * Tests for usePalettes mutation invalidation scoping.
 * Asserts that each mutation invalidates only the query keys it affects.
 */

import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { usePalettes } from '@/lib/hooks/usePalettes'

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1' } })),
}))

vi.mock('@/lib/services/palettes', () => ({
  getPalettes: vi.fn().mockResolvedValue({ palettes: [], error: null }),
  getUserPalettes: vi.fn().mockResolvedValue({ palettes: [], error: null }),
  createPalette: vi.fn().mockResolvedValue({ palette: { id: 'p1' }, error: null }),
  updatePalette: vi.fn().mockResolvedValue({ palette: { id: 'p1' }, error: null }),
  deletePalette: vi.fn().mockResolvedValue(true),
  togglePalettePublic: vi.fn().mockResolvedValue({ isPublic: true }),
  updatePaletteColors: vi.fn().mockResolvedValue({ error: null }),
  updatePaletteName: vi.fn().mockResolvedValue({ error: null }),
  getPublicPalettes: vi.fn().mockResolvedValue({ palettes: [], error: null }),
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
  return invalidateSpy.mock.calls.map((call) =>
    call[0]?.queryKey?.slice(0, 3).join(',')
  )
}

describe('usePalettes invalidation scoping', () => {
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
    const { result } = renderHook(() => usePalettes({ autoFetch: true }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.toggleFavorite).toBeDefined()
    })

    invalidateSpy.mockClear()

    await act(async () => {
      await result.current.toggleFavorite('palette-id-1')
    })

    const keys = getInvalidatedKeys(invalidateSpy)
    expect(keys).toContain('favorites,user-1,palette')
    expect(keys).not.toContain('palettes,user-1')
    expect(keys).not.toContain('palettes,public')
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })

  it('updatePalette invalidates only palettes list key', async () => {
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => usePalettes({ autoFetch: true }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.updatePalette).toBeDefined()
    })

    invalidateSpy.mockClear()

    await act(async () => {
      await result.current.updatePalette('palette-id-1', { name: 'Updated' })
    })

    const keys = getInvalidatedKeys(invalidateSpy)
    expect(keys.some((k) => k.startsWith('palettes,'))).toBe(true)
    expect(keys).not.toContain('palettes,public')
    expect(keys).not.toContain('favorites,user-1,palette')
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })

  it('togglePublic invalidates palettes list and public list only', async () => {
    const wrapper = createWrapper(queryClient)
    const { result } = renderHook(() => usePalettes({ autoFetch: true }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.togglePublic).toBeDefined()
    })

    invalidateSpy.mockClear()

    await act(async () => {
      await result.current.togglePublic('palette-id-1')
    })

    const keys = getInvalidatedKeys(invalidateSpy)
    expect(keys.some((k) => k.startsWith('palettes,'))).toBe(true)
    expect(keys).toContain('palettes,public')
    expect(keys).not.toContain('favorites,user-1,palette')
    expect(invalidateSpy).toHaveBeenCalledTimes(2)
  })
})
