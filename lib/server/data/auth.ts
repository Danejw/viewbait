/**
 * Server-Side Auth Data Fetching
 *
 * Fetches initial auth state server-side to prevent client-side flicker.
 * Used in app/layout.tsx to pass initial state to AuthProvider.
 * Optimized: one profile+role query and parallel fetches to minimize round-trips.
 */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOptionalAuth } from "@/lib/server/utils/auth";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/database";
import type { ResolvedRole } from "@/lib/types/database";

export interface InitialAuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** Resolved from roles table. No row = member. */
  role: ResolvedRole | null;
}

/**
 * Fetch profile and role in a single DB round-trip (profiles left-join roles).
 * Returns { profile, role }. Role is 'admin' only when roles.role = 'admin'.
 */
async function getProfileWithRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ profile: Profile | null; role: ResolvedRole }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, roles(role)")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return { profile: null, role: "member" };
  }

  const roleRow = Array.isArray(data.roles) ? data.roles[0] : data.roles;
  const role: ResolvedRole =
    roleRow?.role === "admin" ? "admin" : "member";

  const { roles: _r, ...profileRow } = data as Profile & {
    roles?: { role: string }[] | { role: string } | null;
  };
  return { profile: profileRow as Profile, role };
}

/**
 * Get initial auth state for client-side hydration.
 * Returns user, session, profile, and role if authenticated.
 * Wrapped with React.cache() for per-request deduplication.
 * Optimized: getSession and profile+role run in parallel after getUser.
 */
export const getInitialAuthState = cache(async (): Promise<InitialAuthState> => {
  try {
    const supabase = await createClient();
    const user = await getOptionalAuth(supabase);

    if (!user) {
      return {
        user: null,
        session: null,
        profile: null,
        role: null,
      };
    }

    const [sessionResult, { profile, role }] = await Promise.all([
      supabase.auth.getSession(),
      getProfileWithRole(supabase, user.id),
    ]);

    const session = sessionResult.data?.session ?? null;

    return {
      user,
      session,
      profile,
      role,
    };
  } catch {
    return {
      user: null,
      session: null,
      profile: null,
      role: null,
    };
  }
});
