/**
 * Profiles Service
 * 
 * Handles user profile CRUD operations via secure API routes.
 * All database operations are server-side only.
 */

import { apiGet, apiPatch } from './api-client'
import type { Profile, ProfileUpdate } from '@/lib/types/database'

/**
 * Get the current user's profile
 */
export async function getProfile(): Promise<{
  profile: Profile | null
  error: Error | null
}> {
  const { data, error } = await apiGet<{ profile: Profile }>('/api/profiles')

  if (error) {
    return {
      profile: null,
      error: new Error(error.message),
    }
  }

  return {
    profile: data?.profile || null,
    error: null,
  }
}

/**
 * Update the current user's profile
 */
export async function updateProfile(
  updates: ProfileUpdate
): Promise<{
  profile: Profile | null
  error: Error | null
}> {
  const { data, error } = await apiPatch<{ profile: Profile }>('/api/profiles', updates)

  if (error) {
    return {
      profile: null,
      error: new Error(error.message),
    }
  }

  return {
    profile: data?.profile || null,
    error: null,
  }
}

/**
 * Get a profile by user ID (for viewing other users' profiles)
 * Note: RLS policies ensure users can only view their own profile
 */
export async function getProfileById(userId: string): Promise<{
  profile: Profile | null
  error: Error | null
}> {
  const { data, error } = await apiGet<{ profile: Profile | null }>(`/api/profiles/${userId}`)

  if (error) {
    return {
      profile: null,
      error: new Error(error.message),
    }
  }

  return {
    profile: data?.profile || null,
    error: null,
  }
}

/**
 * Update avatar URL
 */
export async function updateAvatarUrl(
  avatarUrl: string
): Promise<{
  profile: Profile | null
  error: Error | null
}> {
  return updateProfile({ avatar_url: avatarUrl })
}

/**
 * Update full name
 */
export async function updateFullName(
  fullName: string
): Promise<{
  profile: Profile | null
  error: Error | null
}> {
  return updateProfile({ full_name: fullName })
}

/**
 * Mark that the current user has completed onboarding.
 * Used when the user reaches step 5 (success) on the onboarding page.
 */
export async function markOnboardingCompleted(): Promise<{
  profile: Profile | null
  error: Error | null
}> {
  return updateProfile({ onboarding_completed: true })
}
