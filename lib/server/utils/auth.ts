/**
 * Auth Utility
 * 
 * Centralized authentication checks for API routes.
 * Eliminates duplication across all endpoints.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Require authentication - throws error response if not authenticated
 * @returns User object if authenticated
 * @throws NextResponse with 401 if not authenticated
 */
export async function requireAuth(supabase: SupabaseClient): Promise<User> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }

  return user
}

/**
 * Get optional authentication - returns user or null
 * @returns User object if authenticated, null otherwise
 */
export async function getOptionalAuth(supabase: SupabaseClient): Promise<User | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return null
  }

  return user
}
