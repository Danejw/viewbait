import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  snapOpenAISize,
  resolutionToOpenAISize,
  mapResolutionToQuality,
  callOpenAIImageGeneration,
} from '@/lib/services/openai-image'

const MIN_OPENAI_PIXELS = 655_360

function parseSizePixels(size: string): number {
  const [w, h] = size.split('x').map(Number)
  return w * h
}

describe('openai-image helpers', () => {
  describe('snapOpenAISize', () => {
    it('rounds dimensions to multiples of 16', () => {
      const { width, height, size } = snapOpenAISize(1000, 562)
      expect(width % 16).toBe(0)
      expect(height % 16).toBe(0)
      expect(size).toBe(`${width}x${height}`)
    })

    it('upscales 1024x576 to meet minimum pixel budget', () => {
      const { width, height, size } = snapOpenAISize(1024, 576)
      expect(width % 16).toBe(0)
      expect(height % 16).toBe(0)
      expect(width * height).toBeGreaterThanOrEqual(MIN_OPENAI_PIXELS)
      expect(size).not.toBe('1024x576')
    })

    it('caps dimensions at 3840x2160', () => {
      const { width, height } = snapOpenAISize(8000, 4500)
      expect(width).toBeLessThanOrEqual(3840)
      expect(height).toBeLessThanOrEqual(2160)
    })

    it('enforces max aspect ratio 3:1', () => {
      const { width, height } = snapOpenAISize(3000, 100)
      expect(width / height).toBeLessThanOrEqual(3)
    })

    it('enforces min aspect ratio 1:3', () => {
      const { width, height } = snapOpenAISize(100, 3000)
      expect(width / height).toBeGreaterThanOrEqual(1 / 3)
    })
  })

  describe('resolutionToOpenAISize', () => {
    it('returns a valid size string for 16:9 2K', () => {
      const size = resolutionToOpenAISize('2K', '16:9')
      expect(size).toMatch(/^\d+x\d+$/)
      const [w, h] = size.split('x').map(Number)
      expect(w % 16).toBe(0)
      expect(h % 16).toBe(0)
      expect(w * h).toBeGreaterThanOrEqual(MIN_OPENAI_PIXELS)
    })

    it('upscales 1K 16:9 above minimum pixel budget', () => {
      const size = resolutionToOpenAISize('1K', '16:9')
      expect(parseSizePixels(size)).toBeGreaterThanOrEqual(MIN_OPENAI_PIXELS)
      expect(size).not.toBe('1024x576')
    })
  })

  describe('mapResolutionToQuality', () => {
    it('maps 1K to medium', () => {
      expect(mapResolutionToQuality('1K')).toBe('medium')
    })

    it('maps 2K and 4K to high', () => {
      expect(mapResolutionToQuality('2K')).toBe('high')
      expect(mapResolutionToQuality('4K')).toBe('high')
    })
  })
})

describe('callOpenAIImageGeneration', () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env.OPENAI_API_KEY = originalKey
    vi.restoreAllMocks()
  })

  it('calls generations endpoint when there are no reference images', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'abc123' }] }),
    })
    globalThis.fetch = fetchMock

    const result = await callOpenAIImageGeneration(
      'test prompt',
      [],
      [],
      '1K',
      '16:9'
    )

    expect(result.imageData).toBe('abc123')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/images/generations')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('gpt-image-2')
    expect(body.prompt).toBe('test prompt')
    expect(body.n).toBe(1)
    expect(parseSizePixels(body.size)).toBeGreaterThanOrEqual(MIN_OPENAI_PIXELS)
    expect(body.size).not.toBe('1024x576')
  })

  it('throws when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY
    await expect(
      callOpenAIImageGeneration('p', [], [], '1K', '16:9')
    ).rejects.toThrow('OPENAI_API_KEY')
  })
})
