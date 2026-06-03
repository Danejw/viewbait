import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchImageAsBase64 } from '@/lib/utils/ai-helpers'

vi.mock('@/lib/server/utils/logger', () => ({
  logError: vi.fn(),
}))

describe('fetchImageAsBase64', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('rejects localhost URLs without issuing a fetch', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const result = await fetchImageAsBase64('http://localhost:54321/internal.png')

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects link-local metadata URLs without issuing a fetch', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const result = await fetchImageAsBase64('http://169.254.169.254/latest/meta-data')

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects private network IP URLs without issuing a fetch', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const result = await fetchImageAsBase64('https://10.0.0.12/image.png')

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches public HTTPS image URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: async () => Buffer.from('image-bytes'),
    })
    globalThis.fetch = fetchMock

    const result = await fetchImageAsBase64('https://cdn.example.com/image.png')

    expect(result).toEqual({
      data: Buffer.from('image-bytes').toString('base64'),
      mimeType: 'image/png',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
