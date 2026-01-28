/**
 * Server-Side Auth Data Fetching
 * 
 * Fetches initial auth state server-side to prevent client-side flicker.
 * Used in app/layout.tsx to pass initial state to AuthProvider.
 */

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getOptionalAuth } from '@/lib/server/utils/auth'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types/database'

export interface InitialAuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
}

/**
 * Get initial auth state for client-side hydration
 * Returns user, session, and profile if authenticated
 * Wrapped with React.cache() for per-request deduplication
 */
export const getInitialAuthState = cache(async (): Promise<InitialAuthState> => {
  try {
    const supabase = await createClient()
    const user = await getOptionalAuth(supabase)

    if (!user) {
      return {
        user: null,
        session: null,
        profile: null,
      }
    }

    // Get session
    const { data: { session } } = await supabase.auth.getSession()

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return {
      user,
      session,
      profile: profile || null,
    }
  } catch (error) {
    // If there's an error, return null state (client will handle initialization)
    return {
      user: null,
      session: null,
      profile: null,
    }
  }
})
