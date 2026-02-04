/**
 * Role utilities for API and server-side checks.
 * Resolves user role from roles table. No row = lowest tier (member).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/utils/auth'
import type { ResolvedRole } from '@/lib/types/database'

/**
 * Resolve a user's role from the roles table.
 * Returns 'admin' if user has admin role, 'member' otherwise (including when no row).
 */
export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<ResolvedRole> {
  const { data, error } = await supabase
    .from('roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data || data.role !== 'admin') {
    return 'member'
  }
  return 'admin'
}

/**
 * Require admin role. Use in admin-only API routes.
 * @returns User if authenticated and has admin role
 * @throws NextResponse 401 if not authenticated, 403 if not admin
 */
export async function requireAdmin(supabase: SupabaseClient): Promise<User> {
  const user = await requireAuth(supabase)
  const role = await getUserRole(supabase, user.id)
  if (role !== 'admin') {
    throw NextResponse.json(
      { error: 'Forbidden', code: 'FORBIDDEN' },
      { status: 403 }
    )
  }
  return user
}
