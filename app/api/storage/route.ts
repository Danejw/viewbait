/**
 * Storage Delete API Route
 * 
 * Handles deleting files from private storage buckets using server-side client.
 * Supports single file deletion and batch deletion.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { storageErrorResponse, validationErrorResponse, forbiddenResponse } from '@/lib/server/utils/error-handler'
import { handleStorageApiError } from '@/lib/server/utils/api-helpers'
import { NextResponse } from 'next/server'

export type BucketName = 'thumbnails' | 'faces' | 'style-previews' | 'style-references'

const PRIVATE_BUCKETS: BucketName[] = ['thumbnails', 'faces', 'style-references']
const VALID_BUCKETS: BucketName[] = ['thumbnails', 'faces', 'style-previews', 'style-references']

/**
 * Validates that a path belongs to the authenticated user
 */
function validatePathOwnership(path: string, userId: string): boolean {
  const pathSegments = path.split('/')
  const pathUserId = pathSegments[0]
  return pathUserId === userId
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const bucket = searchParams.get('bucket')
    const path = searchParams.get('path')
    const paths = searchParams.get('paths') // Comma-separated for batch deletion

    // Validate bucket
    if (!bucket) {
      return validationErrorResponse('Bucket is required')
    }

    if (!VALID_BUCKETS.includes(bucket as BucketName)) {
      return validationErrorResponse(`Invalid bucket name. Must be one of: ${VALID_BUCKETS.join(', ')}`)
    }

    // Only allow private buckets through this route
    if (!PRIVATE_BUCKETS.includes(bucket as BucketName)) {
      return validationErrorResponse('This route only accepts private buckets. Use client-side deletion for public buckets.')
    }

    // Determine which paths to delete
    let pathsToDelete: string[] = []

    if (paths) {
      // Batch deletion: paths is comma-separated
      pathsToDelete = paths.split(',').map(p => p.trim()).filter(p => p.length > 0)
    } else if (path) {
      // Single file deletion
      pathsToDelete = [path]
    } else {
      return validationErrorResponse('Either path or paths query parameter is required')
    }

    if (pathsToDelete.length === 0) {
      return validationErrorResponse('No valid paths provided')
    }

    // Validate all paths belong to the user
    for (const filePath of pathsToDelete) {
      if (!validatePathOwnership(filePath, user.id)) {
        return forbiddenResponse(`Path ${filePath} does not belong to your account`)
      }
    }

    // Delete files from storage using server-side client
    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove(pathsToDelete)

    if (deleteError) {
      return storageErrorResponse(
        deleteError,
        'Failed to delete file(s)',
        { route: 'DELETE /api/storage', userId: user.id }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    return handleStorageApiError(error, 'DELETE /api/storage', 'storage-delete', undefined, 'Failed to delete file(s)')
  }
}
