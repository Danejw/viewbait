import type { SupabaseClient } from '@supabase/supabase-js'
import { logError } from '@/lib/server/utils/logger'

const GENERATED_THUMBNAIL_FILENAMES = [
  'thumbnail.png',
  'thumbnail.jpg',
  'thumbnail.webp',
  'thumbnail-400w.jpg',
  'thumbnail-800w.jpg',
] as const

export function buildThumbnailStoragePaths(userId: string, thumbnailIds: string[]): string[] {
  return thumbnailIds.flatMap(thumbnailId =>
    GENERATED_THUMBNAIL_FILENAMES.map(filename => `${userId}/${thumbnailId}/${filename}`)
  )
}

export async function cleanupThumbnailArtifacts(
  supabase: SupabaseClient,
  userId: string,
  thumbnailIds: string[]
): Promise<void> {
  if (thumbnailIds.length === 0) {
    return
  }

  const storagePaths = buildThumbnailStoragePaths(userId, thumbnailIds)
  const { error: storageError } = await supabase.storage
    .from('thumbnails')
    .remove(storagePaths)

  if (storageError) {
    logError(storageError, {
      route: 'thumbnail-cleanup',
      userId,
      operation: 'remove-thumbnail-storage-artifacts',
      thumbnailCount: thumbnailIds.length,
    })
  }

  const { error: deleteError } = await supabase
    .from('thumbnails')
    .delete()
    .in('id', thumbnailIds)

  if (deleteError) {
    logError(deleteError, {
      route: 'thumbnail-cleanup',
      userId,
      operation: 'delete-thumbnail-records',
      thumbnailCount: thumbnailIds.length,
    })
  }
}
