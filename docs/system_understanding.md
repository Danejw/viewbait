# System Understanding

**Version:** 2026-02-14T06:12:59Z  
**Repository:** ViewBait.app (Next.js App Router, Supabase, Stripe, Gemini)

This document is written from the perspective of an onboarding lead engineer. It is execution-path-first: every behavior described points to the exact file paths and functions that implement it today.

---

## 1. End-to-end data flow (UI → server → Supabase → return)

### 1.1 Server entrypoints and request bootstrapping

- **Root layout (server component)**: `app/layout.tsx`
  - Calls `getInitialAuthState()` from `lib/server/data/auth.ts`.
  - That function uses the Supabase server client (`createClient()` from `lib/supabase/server.ts`) and resolves the current user via `getOptionalAuth(supabase)` from `lib/server/utils/auth.ts`.
  - It then fetches session + `profiles` + `roles` (see `getProfileWithRole(...)` inside `lib/server/data/auth.ts`) to return `{ user, session, profile, role }`.

- **Client providers**: `app/providers.tsx`
  - Wraps the application with:
    - `ThemeProvider` (`components/theme-provider`)
    - `QueryClientProvider` (TanStack Query)
    - `AuthProvider` (`lib/hooks/useAuth.tsx`)
    - `SubscriptionProvider` (`lib/hooks/useSubscription.tsx`)

### 1.2 Auth session flow (browser ↔ Supabase ↔ server)

There are three Supabase clients in this repo. Which one you use is a security decision.

- **Browser client**: `lib/supabase/client.ts`
  - `createClient()` uses `createBrowserClient()` from `@supabase/ssr`.
  - Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Used by `AuthProvider` for client-side session initialization and auth listeners (see `lib/hooks/useAuth.tsx`).

- **Server (cookie/session) client**: `lib/supabase/server.ts`
  - `createClient()` uses `createServerClient()` from `@supabase/ssr` and `cookies()` from `next/headers`.
  - Used by route handlers (for example `app/api/thumbnails/route.ts`) and server-side auth bootstrap (`lib/server/data/auth.ts`).
  - Enforces RLS because it operates under the user session (anon key + auth cookies).

- **Server service-role client (bypasses RLS)**: `lib/supabase/service.ts`
  - `createServiceClient()` uses `createClient()` from `@supabase/supabase-js`.
  - Requires `SUPABASE_SERVICE_ROLE_KEY`.
  - Treat this as root database access. This must never be reachable from client code.

**OAuth/email callback execution path**:

- `GET /auth/callback` is implemented in `app/auth/callback/route.ts` (exported `GET(request)`).
  - Exchanges `?code=...` via `supabase.auth.exchangeCodeForSession(code)` using the server client from `lib/supabase/server.ts`.
  - If the user signed in via Google and Supabase returned provider tokens (`data.session.provider_token`), the route persists YouTube integration tokens via `persistYouTubeTokens(...)` (same file).
    - `persistYouTubeTokens(...)` uses `createServiceClient()` from `lib/supabase/service.ts` to upsert into `youtube_integrations`.
  - Redirect target is sanitized by `getAllowedRedirect(...)` from `lib/utils/redirect-allowlist` and defaults to `/studio`.

### 1.3 Thumbnails list flow (Studio UI → GET /api/thumbnails → Supabase → signed URLs)

Representative read flow from the Studio SPA:

1. **UI entrypoint**: `app/studio/page.tsx`
   - Renders the Studio SPA via `<StudioProvider>` from `components/studio/studio-provider.tsx`.

2. **Client orchestration**: `components/studio/studio-provider.tsx`
   - Uses `useThumbnails(...)` (hook) with `enabled: isAuthenticated` and passes sorting and project filters from Studio state.

3. **Service layer**: `lib/services/thumbnails.ts`
   - `getThumbnails(userId, options)` builds query params then calls:
     - `fetchWithTimeout(url, { credentials: 'include', timeoutMs: ... })` from `lib/utils/fetch-with-timeout.ts`.

4. **Route handler**: `app/api/thumbnails/route.ts`
   - `GET(request)`:
     - `const supabase = await createClient()` from `lib/supabase/server.ts`.
     - `const user = await requireAuth(supabase)` from `lib/server/utils/auth.ts`.
     - Parses paging/sort via `parseQueryParams(request, ...)` from `lib/server/utils/api-helpers.ts`.
     - Builds the base query via `buildThumbnailsQuery(supabase, user, ...)` from `lib/server/data/thumbnails.ts`.
     - Applies pagination via `applyCursorPagination(...)` from `lib/server/utils/query-builder.ts`.
     - Refreshes storage URLs via `refreshThumbnailUrls(supabase, thumbnails, user.id)` from `lib/server/utils/url-refresh.ts`.
     - Returns JSON with cache headers via `createCachedResponse(...)` from `lib/server/utils/cache-headers.ts`.
   - Errors are normalized via `handleApiError(...)` from `lib/server/utils/api-helpers.ts`.

5. **Supabase**
   - Table reads happen through the user session client, so **Postgres RLS is enforced**.
   - Signed URLs are minted via `supabase.storage.from('thumbnails').createSignedUrl(...)`.

### 1.4 Thumbnail generation flow (Studio UI → POST /api/generate → Gemini → Storage → DB → return)

Representative write flow for "Generate 1 to 4 variations":

1. **UI orchestration**: `components/studio/studio-provider.tsx`
   - `generateThumbnails()` collects form state then calls `generate(...)` from the `useThumbnailGeneration` hook.

2. **Service layer**: `lib/services/thumbnails.ts`
   - `generateThumbnail(options)` sends JSON to `POST /api/generate`.

3. **Route handler**: `app/api/generate/route.ts`
   - `POST(request)`:
     - Auth: `createClient()` → `requireAuth(supabase)`.
     - Rate limit: `enforceRateLimit('generate', request, user.id)` from `lib/server/utils/rate-limit.ts`.
     - Tier gating: `getTierForUser(supabase, user.id)` from `lib/server/utils/tier.ts`.
     - Credits source: `getSubscriptionRow(supabase, user.id)` from `lib/server/data/subscription.ts`.
     - AI prerequisite: rejects if `process.env.GEMINI_API_KEY` is missing.
     - Inserts placeholder rows in `thumbnails`.
     - Builds a structured JSON prompt server-side (see `promptData` and `prompt` inside `POST()`, plus helper `buildImageReferenceMarkers(...)`).
     - For each variation, calls `generateSingleVariation(...)` (same file), which:
       - Calls Gemini via `callGeminiImageGeneration(...)` from `lib/services/ai-core.ts`.
       - Uploads the image to Supabase Storage at a user-scoped path: `${user.id}/${thumbnailId}/thumbnail.{png|jpg}`.
       - Generates and uploads downscaled variants via `generateThumbnailVariants(...)` from `lib/server/utils/image-variants.ts`.
       - Updates the `thumbnails` row with the final signed URL.
     - Deletes failed placeholder rows via `deleteThumbnailsByIds(...)` from `lib/server/data/thumbnails.ts`.
     - Deducts credits only for successful results using the service role client:
       - `createServiceClient()` from `lib/supabase/service.ts`
       - `decrementCreditsAtomic(...)` from `lib/server/utils/credits.ts` (RPC `decrement_credits_atomic`).
     - Returns `{ results, creditsUsed, creditsRemaining, ... }`.

4. **Supabase**
   - Thumbnail row writes use the user session client (RLS applies).
   - Credit writes use service role client (bypasses RLS). This is only safe because the logic is constrained by an RPC contract and idempotency keys.

### 1.5 Assistant chat flow (Studio chat → POST /api/assistant/chat → Gemini tool output → UI updates)

1. **UI callsite**: `components/studio/studio-provider.tsx`
   - `sendChatMessage(message)` calls `/api/assistant/chat` with `{ conversationHistory, formState }`.

2. **Route handler**: `app/api/assistant/chat/route.ts`
   - Auth: creates server client then checks user via `getOptionalAuth(supabase)` from `lib/server/utils/auth.ts`.
   - Rate limit: `enforceRateLimit('assistant-chat', request, user.id)` from `lib/server/utils/rate-limit.ts`.
   - Calls Gemini function calling via `callGeminiWithFunctionCalling(...)` from `lib/services/ai-core.ts`.
   - Returns structured response:
     - `human_readable_message`
     - `ui_components`
     - `form_state_updates` (with server-only keys stripped by `stripServerOnlyFormUpdates(...)`)
   - Supports streaming mode (`?stream=true`) using a `ReadableStream` and `emitSSE(...)`.
   - If images are attached, the route can upload them into Supabase Storage (style references or faces) using helpers like `uploadBase64ToStyleReferences(...)`, then merge the resulting signed URLs back into `form_state_updates`.

---

## 2. Major subsystems and their boundaries

### 2.1 What lives where

- **App Router pages and route handlers**: `app/**`
  - Studio SPA entrypoint: `app/studio/page.tsx`
  - Auth UI: `app/auth/page.tsx` (client side redirect for authenticated users)
  - Auth callback: `app/auth/callback/route.ts`
  - API surface: `app/api/**/route.ts`

- **UI components**: `components/**`
  - Studio SPA system: `components/studio/**` (state orchestration lives in `components/studio/studio-provider.tsx`)

- **Client hooks**: `lib/hooks/**`
  - Auth state: `lib/hooks/useAuth.tsx`
  - Subscription state and tier gating: `lib/hooks/useSubscription.tsx`

- **Service layer (client-callable HTTP wrappers)**: `lib/services/**`
  - Example: `lib/services/thumbnails.ts` calls `/api/thumbnails`, `/api/generate`, `/api/edit`, etc.
  - The service layer should remain secret-free. Server routes own secrets.

- **Server utilities and data layer**: `lib/server/**`
  - Auth helpers: `lib/server/utils/auth.ts` (`requireAuth`, `getOptionalAuth`)
  - Error handling: `lib/server/utils/error-handler.ts` and `lib/server/utils/api-helpers.ts`
  - Query building: `lib/server/utils/query-builder.ts`
  - Data access helpers: `lib/server/data/*.ts` (for example `lib/server/data/thumbnails.ts`)

- **Supabase schema and migrations**: `supabase/**`
  - Migrations: `supabase/migrations/*.sql` (example: `supabase/migrations/006_rls_core_tables.sql`)
  - Schema snapshots: `supabase/tables/*` and `supabase/tables/SCHEMA_SUMMARY.md`

### 2.2 Trust boundaries (do not blur these)

- **Browser is untrusted**:
  - Anything in client components and `lib/services/**` can be forged. Every server route must validate inputs and enforce auth.

- **API routes are the application boundary**:
  - `app/api/**/route.ts` is where we validate and enforce access before touching Supabase or external APIs.

- **Database is the final security boundary**:
  - RLS is mandatory for user and tenant data (see `docs/database_security_principles.md`).
  - Service role bypass is allowed only for explicitly privileged flows.

---

## 3. Source of truth locations

### 3.1 Authentication

- **Source of truth**: Supabase Auth session.
- **Server**:
  - `requireAuth(supabase)` and `getOptionalAuth(supabase)` in `lib/server/utils/auth.ts`.
  - Server-side bootstrap uses `getInitialAuthState()` in `lib/server/data/auth.ts`.
- **Client**:
  - `AuthProvider` in `lib/hooks/useAuth.tsx` initializes via `supabase.auth.getSession()` and listens via `supabase.auth.onAuthStateChange(...)` using `lib/supabase/client.ts`.

### 3.2 Access control

- **Primary**: Postgres RLS policies in `supabase/migrations/*.sql`.
- **API enforcement**:
  - Auth: `lib/server/utils/auth.ts`
  - Error normalization and logging: `lib/server/utils/api-helpers.ts`, `lib/server/utils/error-handler.ts`, `lib/server/utils/logger.ts`
  - Example resource access check: `getProjectByIdForAccess(...)` from `lib/server/data/projects.ts`, used in `PATCH()` in `app/api/thumbnails/[id]/route.ts`.

### 3.3 Production secrets and env vars

All secrets must be server-only env vars. Any `NEXT_PUBLIC_*` env var is client-exposed by definition.

- **Client-safe (may be used in browser)**:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`lib/supabase/client.ts`, `lib/supabase/server.ts`)
  - `NEXT_PUBLIC_APP_URL` (used for redirect construction in some OAuth routes such as `app/api/youtube/connect/authorize/route.ts`)
  - `NEXT_PUBLIC_APP_VERSION` (used for assistant feedback metadata in `app/api/assistant/chat/route.ts`)

- **Server-only**:
  - `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase/service.ts`)
  - `GEMINI_API_KEY` (routes like `app/api/generate/route.ts`, `app/api/assistant/chat/route.ts`, plus `lib/services/ai-core.ts`)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (`app/api/webhooks/stripe/route.ts`)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (`app/api/youtube/connect/authorize/route.ts`, `app/api/youtube/refresh/route.ts`, `app/api/youtube/connect/callback/route.ts`)
  - `YOUTUBE_DATA_API_KEY` (`app/api/youtube/channel-videos/route.ts`)
  - `INTERNAL_API_SECRET` (`app/api/notifications/route.ts`)
  - `CRON_SECRET` (`app/api/cron/cleanup-free-tier-thumbnails/route.ts`)

---

## 4. System invariants

- **No service role in client code**: `SUPABASE_SERVICE_ROLE_KEY` must never appear in client components or `NEXT_PUBLIC_*` vars. `createServiceClient()` must remain server-only.
- **Prompts are server-only**: prompt construction must remain in route handlers and server-side helpers (for example `app/api/generate/route.ts`, `app/api/assistant/chat/route.ts`, `lib/services/ai-core.ts`).
- **RLS is required**: all user or tenant data tables must have RLS enabled and policies defined (see `docs/database_security_principles.md` and `supabase/migrations/*.sql`).
- **User-scoped storage paths**: generated assets use user-scoped paths in storage (see `generateSingleVariation(...)` in `app/api/generate/route.ts`).
- **Credits are idempotent**: any credit debit must use `decrementCreditsAtomic(...)` (`lib/server/utils/credits.ts`) and an idempotency key.
- **Errors are sanitized**: API errors should flow through `handleApiError(...)` (`lib/server/utils/api-helpers.ts`) and response helpers in `lib/server/utils/error-handler.ts`.

---

## 5. How to safely modify the system

### 5.1 Where to add new features

- **UI and Studio workflow**:
  - Add or extend components in `components/studio/**`.
  - Keep orchestration in `components/studio/studio-provider.tsx` and isolate reusable logic in hooks under `lib/hooks/**`.

- **Client-service calls**:
  - Add a typed wrapper in `lib/services/<feature>.ts`.
  - Prefer using `fetchWithTimeout(...)` from `lib/utils/fetch-with-timeout.ts` or the generic wrappers in `lib/services/api-client.ts`.

- **Server routes**:
  - Add `app/api/<feature>/route.ts` (or nested segments).
  - Use `createClient()` from `lib/supabase/server.ts` and `requireAuth(supabase)` unless intentionally public.
  - Extract reusable queries into `lib/server/data/<feature>.ts`.

### 5.2 How to avoid leaking secrets or prompts

- **Secrets**:
  - Never add new secrets as `NEXT_PUBLIC_*`.
  - Never include secrets in thrown errors or logs.
  - Prefer `logError(...)` from `lib/server/utils/logger.ts` and sanitize client-visible messages via `lib/server/utils/error-handler.ts`.

- **Prompts**:
  - Never return prompts to the client.
  - Never log full prompts in plaintext (especially user-provided content).
  - Prefer structured prompt building and only log small, non-sensitive metadata (route, operation, userId).

### 5.3 How to validate changes

- **Lint**: `npm run lint`
- **Tests**: `npm test` or `npm run test:run`
- **Manual smoke checks**:
  - Sign in (email and Google), verify `/auth/callback` works.
  - Generate thumbnails via `/api/generate`, verify storage URLs load and credits decrement.
  - Load thumbnails via `/api/thumbnails`, verify signed URL refresh works.
  - Use assistant chat via `/api/assistant/chat` in both normal and streaming mode.

---

## 6. How to safely modify the database

When making schema changes:

- Put all changes in `supabase/migrations/`.
- Add RLS policies as part of the migration. Never rely on API code as the only permission layer.
- Prefer views for reads and RPC for sensitive writes (see `docs/database_security_principles.md`).
- For service-role usage, prefer constrained RPC functions over ad hoc writes.

---

## 7. Known gaps and assumptions

- **No Next.js middleware present**: there is no `middleware.ts` in this repo, so route-level gating (redirect unauthenticated users away from `/studio`) is not enforced at the edge. Auth is enforced per API route via `requireAuth(...)`, and the auth page (`app/auth/page.tsx`) redirects authenticated users client-side using `useAuth()`.
- **Provider wiring mismatch**: `app/layout.tsx` passes `initialAuthState={...}` to `<Providers>`, but `app/providers.tsx` does not accept that prop and does not forward `initialUser`, `initialSession`, or `initialProfile` into `AuthProvider` (`lib/hooks/useAuth.tsx`). This likely indicates incomplete wiring or a stale refactor.
- **Debug outbound calls in auth callback**: `app/auth/callback/route.ts` contains debug blocks that call `fetch('http://127.0.0.1:7250/ingest/...')`. In production these will fail, but they are still outbound attempts and should be treated as a security and ops concern.
- **Schema completeness**: `supabase/tables/SCHEMA_SUMMARY.md` notes that schema snapshots are incomplete and that constraints and RLS policies may not be fully exported there. Treat `supabase/migrations/*.sql` and the Supabase dashboard as authoritative.
- **Docs path prefix drift**: several docs in `docs/` refer to paths prefixed with `viewbait/` that do not match the current repo filesystem layout. Prefer this document and the actual paths under repo root.

---

*End of system understanding document.*

