/**
 * Supabase Service Role Client
 * 
 * Creates a Supabase client with service role privileges for server-side operations
 * that require bypassing RLS (e.g., modifying user subscriptions, credit transactions).
 * 
 * WARNING: This client bypasses Row Level Security. Only use for operations that
 * must be performed server-side and cannot be done by regular users.
 * 
 * @example
 * ```tsx
 * // In a Server Component or Route Handler
 * import { createServiceClient } from '@/lib/supabase/service'
 * 
 * export async function POST(request: Request) {
 *   const supabaseService = createServiceClient()
 *   // Use for subscription/credit modifications
 *   await supabaseService.from('user_subscriptions').update(...)
 * }
 * ```
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with service role privileges.
 * This client bypasses RLS and should only be used server-side.
 * 
 * @throws {Error} If SUPABASE_SERVICE_ROLE_KEY is not set
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY environment variable is not set. ' +
      'This is required for server-side operations that modify subscriptions and credits.'
    )
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

