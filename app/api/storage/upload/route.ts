/**
 * Storage Upload API Route
 * 
 * Handles uploading files to private storage buckets using server-side client.
 * This ensures proper authentication and session management.
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
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = formData.get('bucket') as string | null
    const path = formData.get('path') as string | null

    // Validate required fields
    if (!file) {
      return validationErrorResponse('File is required')
    }

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
      return validationErrorResponse('This route only accepts private buckets. Use client-side upload for public buckets.')
    }

    // Validate path format: must start with {userId}/
    const pathSegments = path.split('/')
    const pathUserId = pathSegments[0]
    
    if (!pathUserId || pathUserId !== user.id) {
      return forbiddenResponse('Path must start with your user ID')
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return validationErrorResponse('File must be an image')
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return validationErrorResponse(`Image size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
    }

    // Upload to storage using server-side client
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      })

    if (uploadError || !uploadData) {
      return storageErrorResponse(
        uploadError || new Error('Upload failed'),
        'Failed to upload file',
        { route: 'POST /api/storage/upload', userId: user.id }
      )
    }

    // Get signed URL for the uploaded file (private buckets need signed URLs)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS)

    if (urlError || !urlData?.signedUrl) {
      // Return the path even if URL creation fails
      return NextResponse.json({
        path: uploadData.path,
        url: null,
      })
    }

    return NextResponse.json({
      path: uploadData.path,
      url: urlData.signedUrl,
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/storage/upload', 'storage-upload', undefined, 'Failed to upload file')
  }
}
