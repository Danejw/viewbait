/**
 * Storage List API Route
 * 
 * Handles listing files in a folder for private storage buckets using server-side client.
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
 * Validates that a folder path belongs to the authenticated user
 */
function validateFolderPathOwnership(folderPath: string, userId: string): boolean {
  const pathSegments = folderPath.split('/')
  const pathUserId = pathSegments[0]
  return pathUserId === userId
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const bucket = searchParams.get('bucket')
    const folderPath = searchParams.get('folderPath')

    // Validate required fields
    if (!bucket) {
      return validationErrorResponse('Bucket is required')
    }

    if (!folderPath) {
      return validationErrorResponse('Folder path is required')
    }

    // Validate bucket name
    if (!VALID_BUCKETS.includes(bucket as BucketName)) {
      return validationErrorResponse(`Invalid bucket name. Must be one of: ${VALID_BUCKETS.join(', ')}`)
    }

    // Only allow private buckets through this route
    if (!PRIVATE_BUCKETS.includes(bucket as BucketName)) {
      return validationErrorResponse('This route only accepts private buckets. Use client-side listing for public buckets.')
    }

    // Validate folder path belongs to the user
    if (!validateFolderPathOwnership(folderPath, user.id)) {
      return forbiddenResponse('Folder path does not belong to your account')
    }

    // List files in folder using server-side client
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folderPath)

    if (error) {
      return storageErrorResponse(
        error,
        'Failed to list files',
        { route: 'GET /api/storage/list', userId: user.id }
      )
    }

    // Filter out empty folder placeholder and map to full paths
    const files = (data || [])
      .filter((item: { name: string }) => item.name !== '.emptyFolderPlaceholder')
      .map((item: { name: string }) => `${folderPath}/${item.name}`)

    return NextResponse.json({
      files,
    })
  } catch (error) {
    return handleStorageApiError(error, 'GET /api/storage/list', 'storage-list', undefined, 'Failed to list files')
  }
}
