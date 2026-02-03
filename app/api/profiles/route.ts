/**
 * Profiles API Route
 * 
 * Handles GET and PATCH operations for user profiles.
 * All operations require authentication and enforce RLS policies.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Profile, ProfileUpdate } from '@/lib/types/database'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  notFoundResponse,
  validationErrorResponse,
  databaseErrorResponse ,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * URL validation regex (basic)
 */
const URL_REGEX = /^https?:\/\/.+/

/**
 * GET /api/profiles
 * Get the current user's profile
 */
export async function GET(request: Request) {
  let userId: string | undefined

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    userId = user.id

    // Get user's profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Profile not found
        return notFoundResponse('Profile not found')
      }

      logError(error, {
        route: 'GET /api/profiles',
        userId: user.id,
        operation: 'fetch-profile',
      })
      return databaseErrorResponse('Failed to fetch profile')
    }

    if (!profile) {
      return notFoundResponse('Profile not found')
    }

    return NextResponse.json({ profile })
  } catch (error) {
    return handleApiError(error, 'GET /api/profiles', 'fetch-profile', undefined, 'Failed to fetch profile')
  }
}

/**
 * PATCH /api/profiles
 * Update the current user's profile
 */
export async function PATCH(request: Request) {
  let userId: string | undefined

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    userId = user.id

    // Parse request body
    const body: ProfileUpdate = await request.json()

    // Validate email format if provided
    if (body.email !== undefined && body.email !== null) {
      if (body.email.trim() === '') {
        return validationErrorResponse('Email cannot be empty')
      }
      if (!EMAIL_REGEX.test(body.email)) {
        return validationErrorResponse('Invalid email format')
      }
    }

    // Validate full name if provided
    if (body.full_name !== undefined && body.full_name !== null) {
      const trimmedName = body.full_name.trim()
      if (trimmedName.length === 0) {
        return validationErrorResponse('Full name cannot be empty')
      }
      if (trimmedName.length > 255) {
        return validationErrorResponse('Full name must be 255 characters or less')
      }
      // Update with trimmed value
      body.full_name = trimmedName
    }

    // Validate avatar URL format if provided
    if (body.avatar_url !== undefined && body.avatar_url !== null) {
      if (body.avatar_url.trim() === '') {
        return validationErrorResponse('Avatar URL cannot be empty')
      }
      if (!URL_REGEX.test(body.avatar_url)) {
        return validationErrorResponse('Invalid avatar URL format')
      }
    }

    // Update profile (enforce user.id in WHERE clause for security)
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update(body)
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        // Profile not found
        return notFoundResponse('Profile not found')
      }

      logError(updateError, {
        route: 'PATCH /api/profiles',
        userId: user.id,
        operation: 'update-profile',
      })
      return databaseErrorResponse('Failed to update profile')
    }

    if (!profile) {
      return notFoundResponse('Profile not found')
    }

    return NextResponse.json({ profile })
  } catch (error) {
    return handleApiError(error, 'PATCH /api/profiles', 'update-profile', undefined, 'Failed to update profile')
  }
}
