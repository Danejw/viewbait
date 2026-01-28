/**
 * Supabase Browser Client
 * 
 * Creates a Supabase client for use in browser/client components.
 * This client is used for all client-side database operations.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Creates a Supabase client for browser-side usage.
 * Call this function in client components to get a Supabase instance.
 * 
 * @example
 * ```tsx
 * 'use client'
 * import { createClient } from '@/lib/supabase/client'
 * 
 * function MyComponent() {
 *   const supabase = createClient()
 *   // Use supabase...
 * }
 * ```
 */
export function createClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  if (!client) {
    client = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

  return client
}
