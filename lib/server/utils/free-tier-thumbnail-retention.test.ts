import { describe, expect, it } from 'vitest'
import {
  FREE_TIER_RETENTION_DAYS,
  shouldDeleteThumbnailForFreeTierRetention,
} from '@/lib/server/utils/free-tier-thumbnail-retention'

describe('shouldDeleteThumbnailForFreeTierRetention', () => {
  const now = new Date('2026-09-02T16:00:00.000Z')

  it('never deletes paid-era thumbnails after cancel or downgrade', () => {
    const createdAt = '2026-01-01T00:00:00.000Z'

    expect(
      shouldDeleteThumbnailForFreeTierRetention({
        hasWatermark: false,
        createdAt,
        now,
      }),
    ).toBe(false)
  })

  it('deletes free-era thumbnails older than the retention window', () => {
    const createdAt = new Date(now)
    createdAt.setDate(createdAt.getDate() - (FREE_TIER_RETENTION_DAYS + 1))

    expect(
      shouldDeleteThumbnailForFreeTierRetention({
        hasWatermark: true,
        createdAt: createdAt.toISOString(),
        now,
      }),
    ).toBe(true)
  })

  it('keeps free-era thumbnails inside the retention window', () => {
    const createdAt = new Date(now)
    createdAt.setDate(createdAt.getDate() - (FREE_TIER_RETENTION_DAYS - 1))

    expect(
      shouldDeleteThumbnailForFreeTierRetention({
        hasWatermark: true,
        createdAt: createdAt.toISOString(),
        now,
      }),
    ).toBe(false)
  })

  it('does not treat a missing watermark flag as free-tier content', () => {
    expect(
      shouldDeleteThumbnailForFreeTierRetention({
        hasWatermark: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        now,
      }),
    ).toBe(false)
  })
})
