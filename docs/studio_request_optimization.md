# Studio Request Optimization

## Summary

After integrating the admin view into the studio and adding role to initial auth state, each `GET /studio` (and every other page load) was doing more work: multiple sequential DB round-trips in `getInitialAuthState()`. This doc describes what was optimized and how to reduce the number of studio requests if needed.

## Per-Request Optimizations (Done)

**File: `lib/server/data/auth.ts`**

1. **Single query for profile + role**  
   Replaced separate `profiles` and `roles` selects with one query using a join:  
   `profiles.select('*, roles(role)').eq('id', userId).single()`.  
   That returns the profile and the user’s role in one DB round-trip.

2. **Parallel fetches after user**  
   After `getOptionalAuth(supabase)` we now run in parallel:
   - `supabase.auth.getSession()`
   - `getProfileWithRole(supabase, user.id)` (profile + role in one query)

**Before:** getUser → getSession → profile → role (4 sequential steps).  
**After:** getUser → [getSession, profile+role] (2 steps; step 2 is 2 parallel ops).

This reduces latency for every request that runs the root layout (including `GET /studio`). `getInitialAuthState()` is still wrapped in `React.cache()` so multiple uses in the same request are deduplicated.

## If You Still See Many GET /studio Calls

Possible causes:

- **Link prefetch**  
  Next.js `<Link href="/studio">` prefetches by default when the link is in the viewport. If many links to `/studio` exist (e.g. on the homepage or auth pages), you may see many prefetch requests. To reduce:
  - Use `<Link href="/studio" prefetch={false}>` for non-primary CTAs, or
  - Rely on prefetch only for the main entry link.

- **Redirects**  
  Visiting `/admin` triggers a redirect to `/studio?view=admin`, so you get two requests (GET /admin, then GET /studio). That’s expected.

- **Full navigations**  
  Each full navigation to `/studio` (e.g. from home, auth, onboarding) is one `GET /studio`. Switching views inside the studio (e.g. Admin tab) does not trigger a new request; it’s in-page state.

If you need to dig deeper, use the request timing breakdown (e.g. compile, proxy, render) to see where time is spent and target further optimizations (e.g. caching, lighter layouts).
