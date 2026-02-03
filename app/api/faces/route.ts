/**
 * Faces API Route
 * 
 * Handles GET (list) and POST (create) operations for faces.
 * All operations are server-side only for security.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { refreshFaceUrls } from '@/lib/server/utils/url-refresh'
import {
  validationErrorResponse,
  databaseErrorResponse,
  tierLimitResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { getTierForUser } from '@/lib/server/utils/tier'
import { createCachedResponse } from '@/lib/server/utils/cache-headers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { FaceInsert } from '@/lib/types/database'
import { buildFacesQuery } from '@/lib/server/data/faces'

// Cache GET responses for 60 seconds (ISR)
// POST requests remain dynamic (not cached)
export const revalidate = 60

/**
 * GET /api/faces
 * List faces for the authenticated user
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Build query using shared builder
    const query = buildFacesQuery(supabase, user, {})
    const { data, error } = await query

    if (error) {
      logError(error, {
        route: 'GET /api/faces',
        userId: user.id,
        operation: 'fetch-faces',
      })
      return databaseErrorResponse('Failed to fetch faces')
    }

    // Refresh signed URLs for all face images
    const facesWithUrls = await refreshFaceUrls(supabase, data || [], user.id)

    // Cache as private user data (faces don't change often)
    return createCachedResponse(
      { faces: facesWithUrls },
      { strategy: 'private-user', maxAge: 600 }, // 10 minutes
      request
    )
  } catch (error) {
    return handleApiError(error, 'GET /api/faces', 'fetch-faces', undefined, 'Failed to fetch faces')
  }
}

/**
 * POST /api/faces
 * Create a new face record
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tier = await getTierForUser(supabase, user.id)
    if (!tier.can_create_custom) {
      return tierLimitResponse('Custom styles, palettes, and faces require Starter or higher.')
    }

    // Parse request body
    const body: FaceInsert = await request.json()
    
    // Validate required fields
    if (!body.name || !body.name.trim()) {
      return validationErrorResponse('Name is required')
    }

    // Ensure user_id matches authenticated user
    const faceData: FaceInsert = {
      ...body,
      user_id: user.id, // Override any user_id in body for security
      image_urls: body.image_urls || [],
    }

    // Create face record
    const { data: face, error: insertError } = await supabase
      .from('faces')
      .insert(faceData)
      .select()
      .single()

    if (insertError) {
      logError(insertError, {
        route: 'POST /api/faces',
        userId: user.id,
        operation: 'create-face',
      })
      return databaseErrorResponse('Failed to create face')
    }

    return NextResponse.json({ face }, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'POST /api/faces', 'create-face', undefined, 'Failed to create face')
  }
}

