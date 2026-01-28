/**
 * Profile by ID API Route
 * 
 * Handles GET operations for viewing profiles by user ID.
 * Uses optional authentication - profiles are private (users can only view their own).
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'
import { getOptionalAuth } from '@/lib/server/utils/auth'
import {
  notFoundResponse,
  databaseErrorResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'

/**
 * GET /api/profiles/[id]
 * Get a profile by user ID
 * Note: Profiles are private - users can only view their own profile.
 * RLS policies enforce this at the database level.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
    // Get optional authentication (profiles are private, but we allow unauthenticated requests
    // to return 404 instead of 401 for better UX)
    const user = await getOptionalAuth(supabase)

    // Query profile by ID (RLS will enforce that users can only view their own profile)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Profile not found (or RLS blocked access)
        return notFoundResponse('Profile not found')
      }

      logError(error, {
        route: 'GET /api/profiles/[id]',
        userId: user?.id,
        profileId: id,
        operation: 'fetch-profile-by-id',
      })
      return databaseErrorResponse('Failed to fetch profile')
    }

    if (!profile) {
      return notFoundResponse('Profile not found')
    }

    // RLS policies ensure users can only view their own profile
    // If we got here, the profile exists and the user has access (or it's their own)
    return NextResponse.json({ profile })
  } catch (error) {
    return serverErrorResponse(error, 'Failed to fetch profile', {
      route: 'GET /api/profiles/[id]',
    })
  }
}
