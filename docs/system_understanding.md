# System Understanding

**Version:** 2025-01-29 (document generated for onboarding lead engineers; update this date/time when regenerating.)  
**Repository:** viewbait (Next.js 16, React 19, Supabase, Stripe, Google Gemini)

This document describes real execution paths, file locations, and boundaries so new lead engineers can safely reason about and modify the system.

---

## 1. End-to-end data flow (UI → server → Supabase → return)

### 1.1 Request lifecycle (page load and API)

1. **Browser request** hits the Next.js server. Static assets and API routes are excluded from middleware via `middleware.ts` config matcher (e.g. `_next/static`, `_next/image`, favicon, image extensions).

2. **Middleware** (`viewbait/middleware.ts`):
   - Runs for all non-static, non-API paths (matcher excludes API routes).
   - Creates a Supabase server client with `createServerClient` from `@supabase/ssr`, using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and cookie handlers that read from `request.cookies` and write to the response.
   - Calls `supabase.auth.getUser()` to resolve the session.
   - If path is in `PROTECTED_ROUTES` (e.g. `/studio` and children) and there is no user → redirect to `/auth?redirect=<pathname>`.
   - If path is in `AUTH_ROUTES` (e.g. `/auth`) and user exists and path is not reset-password or callback → redirect to `redirect` query param or `/studio`.
   - Returns the Supabase response object (with cookies) so the session stays in sync.

3. **App layout** (`viewbait/app/layout.tsx`):
   - Renders `<Providers>` (from `viewbait/app/providers.tsx`) which wraps: `ThemeProvider` → `QueryClientProvider` → `AuthProvider` → `SubscriptionProvider`.
   - No server-side call to `getInitialAuthState` was found in the codebase at doc time; `AuthProvider` accepts optional `initialUser`, `initialSession`, `initialProfile` from its parent. If a root layout or parent passes these (e.g. from a server component), that would be the source of initial auth state.

4. **Client auth** (`viewbait/lib/hooks/useAuth.tsx`):
   - `AuthProvider` holds `user`, `session`, `profile`, and auth methods. It can initialize from `initialUser` / `initialSession` / `initialProfile` or rely on client-side Supabase auth state.
   - `useAuth()` is used across the app (e.g. `viewbait/app/page.tsx`, `viewbait/app/studio/page.tsx`, `viewbait/components/studio/studio-sidebar.tsx`) for `isAuthenticated`, `user`, `signOut`, etc.
   - Profile updates go through `viewbait/lib/services/profiles.ts` (e.g. `getProfile()`), which call API routes; those routes use the server Supabase client.

5. **Typical API flow (e.g. list thumbnails)**:
   - **UI:** Component uses a hook or service that calls `fetch('/api/thumbnails?...')` (e.g. `viewbait/lib/services/thumbnails.ts` → `getThumbnails()` builds query params and `fetch(url)`).
   - **Route handler:** `viewbait/app/api/thumbnails/route.ts`:
     - `createClient()` from `viewbait/lib/supabase/server.ts` (async, uses `cookies()` from `next/headers`) to get a Supabase server client with anon key and cookie-based session.
     - `requireAuth(supabase)` from `viewbait/lib/server/utils/auth.ts` → `supabase.auth.getUser()`; if no user, throws `NextResponse.json(..., 401)`.
     - Builds query via `buildThumbnailsQuery()` in `viewbait/lib/server/data/thumbnails.ts` (uses `QueryPatterns.userOwnedWithFavorites` from `viewbait/lib/server/utils/query-builder.ts`), then `applyCursorPagination()` from the same query-builder.
     - Executes query against `thumbnails` table (RLS applies because the client uses the user’s session).
     - `refreshThumbnailUrls()` from `viewbait/lib/server/utils/url-refresh.ts` refreshes signed storage URLs for each thumbnail.
     - Returns JSON (e.g. `createCachedResponse(..., { strategy: 'private-user', maxAge: 300 }, request)` from `viewbait/lib/server/utils/cache-headers.ts`).
   - **Supabase:** All reads/writes go through the server-created client; RLS policies on `thumbnails` (and other tables) enforce `user_id` and visibility rules.

6. **Auth callback (OAuth / email link):**
   - Request hits `viewbait/app/auth/callback/route.ts` with `?code=...`.
   - `createClient()` from `viewbait/lib/supabase/server.ts` then `supabase.auth.exchangeCodeForSession(code)`.
   - On success, provider tokens (e.g. Google) are read from `data.session` and persisted via `persistYouTubeTokens()` which uses `createServiceClient()` from `viewbait/lib/supabase/service.ts` to upsert into `youtube_integrations` (service role bypasses RLS).
   - Response: redirect to `next` or `redirect` query param, default `/studio`.

### 1.2 AI generation flow (thumbnail generate)

- **UI** triggers generation (e.g. via studio components that call the generate API).
- **Route:** `viewbait/app/api/generate/route.ts`:
  - `createClient()` + `requireAuth(supabase)`.
  - Tier and credits: `getTierForUser(supabase, user.id)` (`viewbait/lib/server/utils/tier.ts`) and credit checks; `decrementCreditsAtomic()` in `viewbait/lib/server/utils/credits.ts` uses **service role** client and RPC `decrement_credits_atomic` (idempotency key, etc.).
  - Prompt is built in the route; then `callGeminiImageGeneration()` in `viewbait/lib/services/ai-core.ts` (uses `process.env.GEMINI_API_KEY`, no prompt in client).
  - Image is uploaded to Supabase Storage (user-scoped path), then thumbnail row is written via the same server client.
- **Return:** Thumbnail metadata and/or image URL back to the client; errors go through `serverErrorResponse` / `aiServiceErrorResponse` in `viewbait/lib/server/utils/error-handler.ts`, which use `sanitizeErrorForClient()` from `viewbait/lib/utils/error-sanitizer.ts` so prompts and internal details are not sent to the client.

### 1.3 Assistant chat flow

- **Route:** `viewbait/app/api/assistant/chat/route.ts`.
- Uses `getOptionalAuth(supabase)` (assistant can be used unauthenticated or authenticated).
- Calls `callGeminiWithFunctionCalling()` in `viewbait/lib/services/ai-core.ts` with conversation history and tool definition (`assistantToolDefinition`); prompts and system behavior are defined in the route and in ai-core, not exposed to the client beyond the structured response (e.g. `human_readable_message`, `ui_components`, `form_state_updates`).

---

## 2. Major subsystems and boundaries

| Subsystem | Location | Responsibility |
|-----------|----------|----------------|
| **Routing & auth gate** | `viewbait/middleware.ts` | Session refresh, protected vs auth routes, redirects. Does not run for API routes. |
| **App shell** | `viewbait/app/layout.tsx`, `viewbait/app/providers.tsx` | Root layout, theme, React Query, AuthProvider, SubscriptionProvider. |
| **Pages** | `viewbait/app/page.tsx` (landing), `viewbait/app/studio/page.tsx` (studio), `viewbait/app/auth/*` | Entry points; studio is a single-page experience inside `/studio`. |
| **API routes** | `viewbait/app/api/**/*.ts` | All server-side API handlers; use server Supabase client and server utils only. |
| **Supabase clients** | `viewbait/lib/supabase/server.ts`, `viewbait/client.ts`, `viewbait/service.ts` | Server (cookies, RLS), browser (anon, RLS), service role (bypass RLS). |
| **Auth utilities** | `viewbait/lib/server/utils/auth.ts` | `requireAuth(supabase)`, `getOptionalAuth(supabase)` for route handlers. |
| **Server data layer** | `viewbait/lib/server/data/*.ts` | Query builders and server-side fetch helpers (thumbnails, auth, notifications, subscription, etc.). |
| **Query building** | `viewbait/lib/server/utils/query-builder.ts` | `QueryPatterns.userOwned`, `userOwnedWithFavorites`, `applyCursorPagination`, `applyPagination`, `applyOrder`. |
| **Services (client-callable)** | `viewbait/lib/services/*.ts` | Thumbnails, styles, palettes, faces, storage, subscriptions, notifications, auth, Stripe, YouTube, AI (ai-core). Services call `fetch('/api/...')` or Supabase from client where applicable; **secrets and prompt construction stay in API routes and server**. |
| **Error handling** | `viewbait/lib/server/utils/error-handler.ts`, `viewbait/lib/utils/error-sanitizer.ts` | Standardized API error responses; sanitization to avoid leaking prompts/PII. |
| **URL refresh** | `viewbait/lib/server/utils/url-refresh.ts` | Refresh signed storage URLs (thumbnails, faces, style-references) with expiry/threshold logic. |
| **Credits & tier** | `viewbait/lib/server/utils/credits.ts`, `viewbait/lib/server/utils/tier.ts`, `viewbait/lib/server/data/subscription-tiers.ts` | Atomic credit deduction (RPC), tier resolution from `user_subscriptions` + product config. |
| **Hooks** | `viewbait/lib/hooks/*.ts(x)` | useAuth, useSubscription, useThumbnails, useStyles, usePalettes, useFaces, useNotifications, etc.; wrap React Query or auth state. |
| **Types** | `viewbait/lib/types/database.ts` | Shared DB and API types (Profile, DbThumbnail, etc.). |

**Boundaries:**

- **Client vs server:** API routes and Server Components use `viewbait/lib/supabase/server.ts` and server utils; client components use `viewbait/lib/supabase/client.ts` and services that call APIs. Never pass service role client or env secrets to the client.
- **RLS:** Normal reads/writes use the server or browser Supabase client (anon key + user session). Service role (`viewbait/lib/supabase/service.ts`) is used only where RLS must be bypassed (e.g. auth callback YouTube tokens, credits RPC, broadcast notifications, Stripe webhook handling).
- **AI:** Prompt construction and Gemini calls are in API routes and `viewbait/lib/services/ai-core.ts`; `GEMINI_API_KEY` is server-only. Client only sends structured input and receives sanitized or structured output.

---

## 3. Source of truth

### 3.1 Authentication

- **Session:** Supabase Auth; session is stored in cookies and read in middleware and in route handlers via `createClient()` from `viewbait/lib/supabase/server.ts` (and in auth callback via the same).
- **Who is logged in:** Determined by `supabase.auth.getUser()` in middleware and in `requireAuth` / `getOptionalAuth` (`viewbait/lib/server/utils/auth.ts`). No separate session store; Supabase is the source of truth.
- **Profile (display name, avatar, etc.):** `profiles` table; RLS and application code enforce that users can only read/update their own row. Initial profile for the client can be supplied by server (e.g. root layout) or fetched via `getProfile()` from `viewbait/lib/services/profiles.ts` which hits the API.

### 3.2 Access control

- **Route-level protection:** Middleware (`viewbait/middleware.ts`) redirects unauthenticated users away from `PROTECTED_ROUTES` (e.g. `/studio`) and authenticated users away from `AUTH_ROUTES` (e.g. `/auth`) except reset-password and callback.
- **API-level protection:** Each protected API route calls `requireAuth(supabase)` (or `getOptionalAuth` where optional). No single middleware enforces auth for all APIs; each route is responsible.
- **Admin:** Admin-only behavior (e.g. broadcast notifications) is enforced in the route by reading `profiles.is_admin` with the user’s client. Example: `viewbait/app/api/notifications/broadcast/route.ts` — after `requireAuth(supabase)`, it selects `profiles.is_admin` for that user and returns 403 if not admin; then uses `createServiceClient()` for the bulk insert.
- **RLS:** Database policies (defined in Supabase migrations under `viewbait/supabase/migrations/`) are the source of truth for which rows a user can select/insert/update/delete. Service role bypasses RLS.

### 3.3 Production secrets and env

- **Defined in:** `.env` / `.env.local` (not committed). Example template: `viewbait/.env.example`.
- **Server-only (never expose to client):**
  - `SUPABASE_SERVICE_ROLE_KEY` — used only in `viewbait/lib/supabase/service.ts`.
  - `GEMINI_API_KEY` — used only in `viewbait/lib/services/ai-core.ts` (server-side).
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — used in `viewbait/app/api/webhooks/stripe/route.ts` and Stripe service code.
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — used server-side for OAuth (e.g. Supabase Auth provider config; callback persists tokens via service client).
- **Client-safe (NEXT_PUBLIC_*):**
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by browser client and middleware; anon key is safe for client use with RLS.
- **Validation:** Service role client throws if `SUPABASE_SERVICE_ROLE_KEY` is missing; Stripe webhook and other routes check for their required env and return 500 or 400 if missing. No single startup validation file was found for all env vars.

---

## 4. System invariants

- **Session consistency:** Middleware must return the same response object that had cookies set by the Supabase client (or copy cookies onto any new response). Otherwise the session can go out of sync and users can be logged out. See comments in `viewbait/middleware.ts`.
- **No secrets in client bundle:** No `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, or webhook secrets in client code or in `NEXT_PUBLIC_*` vars. AI prompts are built only in API routes or server-side ai-core.
- **User-scoped data:** Thumbnails, faces, styles, palettes, etc. are keyed by `user_id`. API routes override or ignore `user_id` from the body and set it from `requireAuth(supabase)` (e.g. `viewbait/app/api/thumbnails/route.ts` POST).
- **Credits:** Credit deduction is done via RPC `decrement_credits_atomic` with an idempotency key; only server-side code uses the service role client for this. Free tier limits and tier resolution are enforced in routes using `getTierForUser()` and tier config from `viewbait/lib/server/data/subscription-tiers.ts` and `viewbait/lib/constants/subscription-tiers.ts`.
- **Errors to client:** All API error responses that might contain implementation details or third-party messages go through helpers in `viewbait/lib/server/utils/error-handler.ts` and `viewbait/lib/utils/error-sanitizer.ts` so that prompts, stack traces, and raw API errors are not sent to the client.
- **Signed URLs:** Storage URLs returned to the client are short-lived signed URLs. The `url-refresh` utility is used to refresh them when expired or near expiry when serving lists (e.g. thumbnails).

---

## 5. How to safely modify the system

### 5.1 Adding new API routes

- **Place:** Add a new file under `viewbait/app/api/<resource>/route.ts` (or `viewbait/app/api/<resource>/[id]/route.ts` for dynamic segments). Follow existing patterns (e.g. `viewbait/app/api/thumbnails/route.ts`).
- **Auth:** Use `createClient()` from `viewbait/lib/supabase/server.ts`, then `requireAuth(supabase)` for protected routes or `getOptionalAuth(supabase)` for optional auth.
- **Data access:** Prefer the server data layer (`viewbait/lib/server/data/*.ts`) and `QueryPatterns` / helpers in `viewbait/lib/server/utils/query-builder.ts` so RLS applies and patterns stay consistent. Use the **service role** client only when you have a clear reason (e.g. cross-user write, RPC that must bypass RLS) and document it.
- **Responses:** Use helpers from `viewbait/lib/server/utils/error-handler.ts` for errors and, where appropriate, `createCachedResponse()` from `viewbait/lib/server/utils/cache-headers.ts` for cache headers.
- **Validation:** Validate and parse input (query params, body); reject invalid input with `validationErrorResponse()` or similar. Do not trust `user_id` (or other auth-related fields) from the client; set them from the authenticated user.

### 5.2 Adding new features that call external APIs or use secrets

- **Secrets:** Keep all new secrets in server-side env (no `NEXT_PUBLIC_*`). Use them only in API route handlers or server-only modules (e.g. under `viewbait/lib/server/`, or in `viewbait/lib/services/*.ts` only when called from the server).
- **Prompts and AI:** Keep prompt construction and model calls in API routes or in `viewbait/lib/services/ai-core.ts` (or a similar server-only service). Never send raw prompts or system instructions to the client; use structured request/response and sanitize errors with `sanitizeErrorForClient()` / `sanitizeApiErrorResponse()` before logging or returning.
- **Stripe / webhooks:** Webhook handlers must verify signatures using the webhook secret (see `viewbait/app/api/webhooks/stripe/route.ts`). Use the service role client for any DB updates triggered by webhooks if they affect multiple users or internal state.

### 5.3 Adding new protected or auth routes

- **Protected pages:** Add the path to `PROTECTED_ROUTES` in `viewbait/middleware.ts` so unauthenticated users are redirected to `/auth` with a redirect param.
- **Auth-only pages (e.g. login):** Add the path to `AUTH_ROUTES` so logged-in users are redirected away (e.g. to `/studio`).
- **New API routes:** As above, call `requireAuth(supabase)` at the start of the handler; do not rely only on middleware because middleware does not run for API routes.

### 5.4 Validating changes

- **Typecheck:** `npm run typecheck` (or `tsc` with project `tsconfig.build.json`).
- **Lint:** `npm run lint` (ESLint).
- **Tests:** `npm run test` / `npm run test:run` (Vitest). Prefer tests for server utils (auth, credits, query builder, error sanitizer) and for services that are easy to mock.
- **Manual:** Test auth flows (login, logout, protected route redirect, auth callback), at least one full flow (e.g. list thumbnails, generate thumbnail), and error paths (401, 403, 500) to ensure no raw errors or prompts leak.
- **Env:** Ensure any new env vars are documented in `viewbait/.env.example` and that server-only vars are not prefixed with `NEXT_PUBLIC_`.

---

## 6. Known gaps and assumptions

- **Initial auth state:** The doc did not find a root layout or parent that passes `getInitialAuthState()` (from `viewbait/lib/server/data/auth.ts`) into `AuthProvider`. If such wiring exists elsewhere (e.g. in a layout under `app/`), that would be the source of server-rendered auth state and would reduce client-side flicker. If not, the app may show a brief unauthenticated state before client-side auth hydrates.
- **RLS policies:** Only a subset of migrations was read (e.g. `001_create_notifications.sql`, `002_add_profiles_is_admin.sql`). The full set of RLS policies for all tables (thumbnails, profiles, user_subscriptions, etc.) lives in Supabase migrations and possibly in Supabase dashboard; they were not fully enumerated here. Assume all user-scoped tables have RLS that restricts by `auth.uid()` or equivalent.
- **Stripe webhook idempotency:** The Stripe webhook handler checks `stripe_webhook_events` for `event.id` and skips processing if already present. The exact schema and any other idempotency mechanisms (e.g. for checkout or subscription updates) were not fully traced.
- **Cron / cleanup:** There is a route `viewbait/app/api/cron/cleanup-free-tier-thumbnails/route.ts`. How it is invoked (Vercel cron, external scheduler, or manual) and whether it is protected by a secret or token were not confirmed.
- **Database schema:** Types in `viewbait/lib/types/database.ts` are the main reference for the app; the actual schema is defined in Supabase migrations and may have more tables or columns (e.g. optional `thumbnail_400w_url` mentioned in code). For authoritative schema, rely on migrations and Supabase.
- **Feature flags / experiments:** Routes under `viewbait/app/api/experiments/` exist; the full experiment and analytics model and how they integrate with the rest of the product were not fully traced.

---

*End of system understanding document.*
