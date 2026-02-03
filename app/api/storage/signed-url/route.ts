/**
 * Storage Signed URL API Route
 * 
 * Handles creating signed URLs for private storage bucket files using server-side client.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { storageErrorResponse, validationErrorResponse, forbiddenResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS } from '@/lib/server/utils/url-refresh'
import { NextResponse } from 'next/server'

export type BucketName = 'thumbnails' | 'faces' | 'style-previews' | 'style-references'

const PRIVATE_BUCKETS: BucketName[] = ['thumbnails', 'faces', 'style-references']
const VALID_BUCKETS: BucketName[] = ['thumbnails', 'faces', 'style-previews', 'style-references']
const DEFAULT_EXPIRES_IN = SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS

/**
 * Validates that a path belongs to the authenticated user
 */
function validatePathOwnership(path: string, userId: string): boolean {
  const pathSegments = path.split('/')
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
    const path = searchParams.get('path')
    const expiresInParam = searchParams.get('expiresIn')

    // Validate required fields
    if (!bucket) {
      return validationErrorResponse('Bucket is required')
    }

    if (!path) {
      return validationErrorResponse('Path is required')
    }

    // Validate bucket name
    if (!VALID_BUCKETS.includes(bucket as BucketName)) {
      return validationErrorResponse(`Invalid bucket name. Must be one of: ${VALID_BUCKETS.join(', ')}`)
    }

    // Only allow private buckets through this route
    if (!PRIVATE_BUCKETS.includes(bucket as BucketName)) {
      return validationErrorResponse('This route only accepts private buckets. Use getPublicUrl() for public buckets.')
    }

    // Validate path belongs to the user
    if (!validatePathOwnership(path, user.id)) {
      return forbiddenResponse('Path does not belong to your account')
    }

    // Parse expiresIn (default to 1 year)
    let expiresIn = DEFAULT_EXPIRES_IN
    if (expiresInParam) {
      const parsed = parseInt(expiresInParam, 10)
      if (!isNaN(parsed) && parsed > 0) {
        expiresIn = parsed
      }
    }

    // Create signed URL using server-side client
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (urlError || !urlData?.signedUrl) {
      return storageErrorResponse(
        urlError || new Error('Failed to create signed URL'),
        'Failed to create signed URL',
        { route: 'GET /api/storage/signed-url', userId: user.id }
      )
    }

    return NextResponse.json({
      url: urlData.signedUrl,
    })
  } catch (error) {
    return handleApiError(error, 'GET /api/storage/signed-url', 'create-signed-url', undefined, 'Failed to create signed URL')
  }
}
