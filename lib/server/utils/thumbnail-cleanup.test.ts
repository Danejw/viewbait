import { describe, expect, it, vi } from 'vitest'
import {
  buildThumbnailStoragePaths,
  cleanupThumbnailArtifacts,
} from '@/lib/server/utils/thumbnail-cleanup'

describe('buildThumbnailStoragePaths', () => {
  it('returns all generated thumbnail object paths for each id', () => {
    expect(buildThumbnailStoragePaths('user-1', ['thumb-a', 'thumb-b'])).toEqual([
      'user-1/thumb-a/thumbnail.png',
      'user-1/thumb-a/thumbnail.jpg',
      'user-1/thumb-a/thumbnail.webp',
      'user-1/thumb-a/thumbnail-400w.jpg',
      'user-1/thumb-a/thumbnail-800w.jpg',
      'user-1/thumb-b/thumbnail.png',
      'user-1/thumb-b/thumbnail.jpg',
      'user-1/thumb-b/thumbnail.webp',
      'user-1/thumb-b/thumbnail-400w.jpg',
      'user-1/thumb-b/thumbnail-800w.jpg',
    ])
  })
})

describe('cleanupThumbnailArtifacts', () => {
  it('removes storage objects and database rows for generated thumbnails', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null })
    const inFilter = vi.fn().mockResolvedValue({ error: null })
    const deleteRows = vi.fn(() => ({ in: inFilter }))
    const from = vi
      .fn()
      .mockReturnValueOnce({ remove })
      .mockReturnValueOnce({ delete: deleteRows })
    const supabase = {
      storage: { from },
      from,
    }

    await cleanupThumbnailArtifacts(
      supabase as never,
      'user-1',
      ['thumb-a', 'thumb-b']
    )

    expect(remove).toHaveBeenCalledWith(buildThumbnailStoragePaths('user-1', ['thumb-a', 'thumb-b']))
    expect(deleteRows).toHaveBeenCalled()
    expect(inFilter).toHaveBeenCalledWith('id', ['thumb-a', 'thumb-b'])
  })
})
