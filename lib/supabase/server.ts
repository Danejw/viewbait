/**
 * Supabase Server Client
 * 
 * Creates a Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. This client handles cookie-based session management.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for server-side usage.
 * Must be called within a Server Component, Route Handler, or Server Action.
 * 
 * @example
 * ```tsx
 * // In a Server Component
 * import { createClient } from '@/lib/supabase/server'
 * 
 * export default async function Page() {
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('thumbnails').select()
 *   return <div>{JSON.stringify(data)}</div>
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // In a Route Handler (app/api/route.ts)
 * import { createClient } from '@/lib/supabase/server'
 * 
 * export async function GET() {
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('thumbnails').select()
 *   return Response.json(data)
 * }
 * ```
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
