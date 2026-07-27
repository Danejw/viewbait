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
 * Require authentication for a route that may be called with an OAuth bearer
 * token. Passing the token explicitly to getUser validates it with Supabase
 * Auth even though the database client itself has no cookie session.
 */
export async function requireAuthForRequest(
  supabase: SupabaseClient,
  request: Request,
): Promise<User> {
  const authorization = request.headers.get('authorization')
  const accessToken = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''

  if (!accessToken) return requireAuth(supabase)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken)

  if (authError || !user) {
    throw NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
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
