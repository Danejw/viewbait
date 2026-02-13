/**
 * Face Image Upload API Route
 * 
 * Handles uploading face images to storage using server-side client.
 * This ensures proper authentication and session management.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  tierLimitResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { getTierForUser } from '@/lib/server/utils/tier'
import { getCustomAssetCounts, canHaveFaceWithinFreeTier } from '@/lib/server/utils/custom-asset-limits'
import { SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS } from '@/lib/server/utils/url-refresh'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tier = await getTierForUser(supabase, user.id)
    if (!tier.can_create_custom) {
      const counts = await getCustomAssetCounts(supabase, user.id)
      if (!canHaveFaceWithinFreeTier(counts)) {
        return tierLimitResponse('Free tier allows one face. Upgrade for more.')
      }
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null
    const faceId = formData.get('faceId') as string | null
    const index = formData.get('index') as string | null

    // Validate required fields
    if (!file) {
      return validationErrorResponse('File is required')
    }

    if (!userId || userId !== user.id) {
      return validationErrorResponse('Invalid user ID')
    }

    if (!faceId) {
      return validationErrorResponse('Face ID is required')
    }

    const indexNum = index ? parseInt(index, 10) : 0
    if (isNaN(indexNum) || indexNum < 0) {
      return validationErrorResponse('Invalid index')
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return validationErrorResponse('File must be an image')
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return validationErrorResponse('Image size must be less than 10MB')
    }

    // Construct storage path: {userId}/{faceId}/{index}.{ext}
    const ext = file.name.split('.').pop() || 'png'
    const storagePath = `${userId}/${faceId}/${indexNum}.${ext}`

    // Upload to storage using server-side client
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('faces')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      })

    if (uploadError || !uploadData) {
      logError(uploadError || new Error('Upload failed'), {
        route: 'POST /api/faces/upload',
        userId: user.id,
        faceId,
        operation: 'upload-face-image',
      })
      return NextResponse.json(
        { error: 'Failed to upload image', code: 'UPLOAD_ERROR' },
        { status: 500 }
      )
    }

    // Get signed URL for the uploaded file
    const { data: urlData, error: urlError } = await supabase.storage
      .from('faces')
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS)

    if (urlError || !urlData?.signedUrl) {
      logError(urlError || new Error('Failed to create signed URL'), {
        route: 'POST /api/faces/upload',
        userId: user.id,
        faceId,
        operation: 'create-signed-url',
      })
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
    return handleApiError(error, 'POST /api/faces/upload', 'upload-face-image', undefined, 'Failed to upload face image')
  }
}
