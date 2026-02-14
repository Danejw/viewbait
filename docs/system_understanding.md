# System Understanding

**Version:** 2026-02-14 08:38:58Z  
**Audience:** New lead engineers onboarding to this repository  
**Perspective:** Onboarding lead engineer (how I’d explain the system and how to change it safely)

This document is intentionally **execution-path driven**. Every described behavior references the exact file paths and exported functions that implement it. If you can’t find the referenced file/function in the repo, treat it as a **gap/assumption** (and see the “Known gaps and assumptions” section).

---

## End-to-end data flow narrative (UI → server → Supabase → return)

At a high level:

- **UI**: `app/**` (pages/layouts) + `components/**` (reusable UI)  
- **Client data layer**: `lib/hooks/**` (React Query hooks) → `lib/services/**` (typed `fetch('/api/...')` wrappers)  
- **Server surface**: `app/api/**/route.ts` (Next.js Route Handlers)  
- **Database/storage**: Supabase (Postgres with RLS + Storage signed URLs) via `lib/supabase/{server,client,service}.ts`

### Execution path: Studio thumbnails list (canonical “read” flow)

1. **Route entrypoint (UI)**
   - Studio is a SPA mounted at `app/studio/page.tsx` (default export `StudioPage`), which mounts `StudioProvider` and the Studio component tree.

2. **React Query hook**
   - Thumbnails are fetched via `lib/hooks/useThumbnails.ts` (export `useThumbnails`).
   - `useThumbnails` uses `useInfiniteQuery(...)` and calls the service `getThumbnails(...)`.

3. **Client service**
   - `lib/services/thumbnails.ts` exports `getThumbnails(userId, options)`.
   - It builds query params and calls:
     - `fetchWithTimeout('/api/thumbnails?...', { credentials: 'include' })` from `lib/utils/fetch-with-timeout.ts`.

4. **API route handler**
   - `app/api/thumbnails/route.ts` exports `GET(request: Request)`.
   - It:
     - Creates a cookie-backed Supabase client via `createClient()` from `lib/supabase/server.ts`.
     - Enforces auth via `requireAuth(supabase)` from `lib/server/utils/auth.ts`.
     - Parses and validates query params via `parseQueryParams(...)` from `lib/server/utils/api-helpers.ts`.
     - Builds the base query via `buildThumbnailsQuery(...)` from `lib/server/data/thumbnails.ts`.
     - Applies cursor pagination via `applyCursorPagination(...)` from `lib/server/utils/query-builder.ts`.
     - Refreshes signed URLs via `refreshThumbnailUrls(...)` from `lib/server/utils/url-refresh.ts`.
     - Returns JSON using `createCachedResponse(...)` from `lib/server/utils/cache-headers.ts` (strategy `private-dynamic`).

5. **Supabase**
   - Database access uses the user’s session cookies via the server client in `lib/supabase/server.ts`, so **RLS must enforce row isolation**.

6. **Return to UI**
   - The JSON payload returns to the client, and `useThumbnails` maps DB rows to UI types using `mapDbThumbnailToThumbnail` from `lib/types/database.ts`.

### Execution path: AI thumbnail generation (canonical “write” flow)

1. **Client service**
   - Generation is initiated by calling `generateThumbnail(options)` in `lib/services/thumbnails.ts`, which calls `POST /api/generate`.

2. **API route handler**
   - `app/api/generate/route.ts` exports `POST(request: Request)`.
   - Core steps:
     - Server Supabase client: `createClient()` from `lib/supabase/server.ts`.
     - Auth: `requireAuth(supabase)` from `lib/server/utils/auth.ts`.
     - Rate limiting: `enforceRateLimit('generate', request, user.id)` from `lib/server/utils/rate-limit.ts`.
     - Tier gating: `getTierForUser(...)` / tier config from `lib/server/utils/tier.ts` and `lib/server/data/subscription-tiers.ts`.
     - Credits: reads subscription via `getSubscriptionRow(...)` from `lib/server/data/subscription.ts` and performs atomic deduction via `decrementCreditsAtomic(...)` from `lib/server/utils/credits.ts`.
       - Credit mutation uses a **service role Supabase client**: `createServiceClient()` from `lib/supabase/service.ts` (bypasses RLS) and calls the RPC `decrement_credits_atomic`.
     - Prompt construction happens **inside the route** (see `promptData` and `prompt` in `app/api/generate/route.ts`).
     - Gemini call happens in `lib/services/ai-core.ts` via `callGeminiImageGeneration(...)` using `process.env.GEMINI_API_KEY` (server-only).
     - Storage upload + signed URLs + DB update happen in `generateSingleVariation(...)` (local helper in `app/api/generate/route.ts`).

3. **Return to UI**
   - Single variation: `{ imageUrl, thumbnailId, creditsUsed, creditsRemaining }`
   - Batch variations: `{ results: [...], creditsUsed, creditsRemaining, totalRequested, totalSucceeded, totalFailed }`

### Execution path: Auth bootstrap (server → client hydration)

1. **Server layout**
   - `app/layout.tsx` (default export `RootLayout`) calls `getInitialAuthState()` from `lib/server/data/auth.ts`.

2. **Auth state computation**
   - `lib/server/data/auth.ts` exports `getInitialAuthState` (wrapped with `cache(...)`).
   - It creates a server Supabase client (`lib/supabase/server.ts`), resolves user via `getOptionalAuth(...)`, then fetches `supabase.auth.getSession()` plus profile+role via `getProfileWithRole(...)` (local helper in the same file).

3. **Client provider layer**
   - `app/providers.tsx` wraps `QueryClientProvider` → `AuthProvider` → `SubscriptionProvider`.
   - `AuthProvider` is `lib/hooks/useAuth.tsx` and supports server-provided `initialUser`/`initialSession`/`initialProfile`.

Whether the server result is currently plumbed all the way into `AuthProvider` is a **known gap** (see below).

---

## Major subsystems and their boundaries

### UI and client state

- **Routes/layouts**: `app/**` (App Router)
  - Examples: `app/studio/page.tsx`, `app/admin/page.tsx`, `app/auth/*`
- **Reusable components**: `components/**`
- **React Query hooks (client)**: `lib/hooks/**` (example: `lib/hooks/useThumbnails.ts`)
- **Service layer (client-callable HTTP)**: `lib/services/**` (example: `lib/services/thumbnails.ts`)

Client code should not embed secrets, should prefer `@/` imports, and should not directly use the service-role client.

### Server/API surface (Next.js route handlers)

- **API routes**: `app/api/**/route.ts`
- **Shared server helpers**:
  - Auth guards: `lib/server/utils/auth.ts` (`requireAuth`, `getOptionalAuth`)
  - Role checks: `lib/server/utils/roles.ts` (`requireAdmin`, `getUserRole`)
  - Tier checks: `lib/server/utils/tier.ts` (`getTierForUser`, `getTierNameForUser`)
  - Error responses: `lib/server/utils/error-handler.ts`
  - Error sanitization: `lib/utils/error-sanitizer.ts`
  - Query building: `lib/server/utils/query-builder.ts`

### Supabase (Postgres + Storage)

- **Supabase clients**:
  - Server session client: `lib/supabase/server.ts` (`createClient`)
  - Browser anon client: `lib/supabase/client.ts` (`createClient`)
  - Service role client: `lib/supabase/service.ts` (`createServiceClient`)
- **Schema and migrations**:
  - SQL migrations: `supabase/migrations/**`
  - Schema exports: `supabase/tables/**` and `supabase/tables/SCHEMA_SUMMARY.md`

### AI (Gemini)

- **Low-level API calls**: `lib/services/ai-core.ts` (e.g. `callGeminiImageGeneration`, `callGeminiWithFunctionCalling`)
- **Prompt/system instruction construction**: intentionally in route handlers
  - Example: `app/api/generate/route.ts` builds prompts.

### Assistant chat

- `app/api/assistant/chat/route.ts` is a full server-side orchestrator:
  - Auth (requires user): `getOptionalAuth(...)` then returns 401 if missing.
  - Rate limiting: `enforceRateLimit('assistant-chat', ...)`.
  - Gemini structured output: `callGeminiWithFunctionCalling(...)` from `lib/services/ai-core.ts`.
  - Server-side uploads for attached images: `uploadBase64ToStyleReferences(...)` and `uploadBase64ToFaceImage(...)` local helpers.
  - “Server-only” keys are stripped before returning to client via `stripServerOnlyFormUpdates(...)`.

### Billing (Stripe)

- Webhook handler: `app/api/webhooks/stripe/route.ts`
  - Verifies signatures using `STRIPE_WEBHOOK_SECRET`.
  - Uses service role client (`createServiceClient`) for DB updates and idempotency tracking (`stripe_webhook_events`).

### YouTube integration

Two parallel implementations exist:

- **App-owned OAuth**:
  - Start: `app/api/youtube/connect/authorize/route.ts` (Pro-only)
  - Callback: `app/api/youtube/connect/callback/route.ts`
  - Persists tokens via `createServiceClient()` into `youtube_integrations`.

- **Supabase auth callback capture**:
  - `app/auth/callback/route.ts` exchanges Supabase `code` for session and may persist `provider_token` via service role into `youtube_integrations`.

---

## Source of truth locations (auth, access control, production secrets)

### Authentication

- **Server auth checks**: `lib/server/utils/auth.ts`
  - `requireAuth(supabase)` is the canonical hard gate.
  - `getOptionalAuth(supabase)` is the canonical optional gate.
- **Server Supabase client (cookie session)**: `lib/supabase/server.ts` (`createClient`)
- **Client auth state**: `lib/hooks/useAuth.tsx` (`AuthProvider`, `useAuth`)

### Access control

Access control is layered and must be consistent:

- **DB/RLS**: implemented in Supabase (see `supabase/migrations/**` and the live project)
- **API layer**:
  - “Must be signed in”: `requireAuth(...)`
  - “Admin only”: `requireAdmin(...)` in `lib/server/utils/roles.ts`
  - “Tier gated”: `getTierNameForUser(...)` checks in routes like:
    - `app/api/youtube/connect/authorize/route.ts`
    - `app/api/assistant/chat/route.ts`
- **Client visibility of admin UI**:
  - Role is exposed by `app/api/user/role/route.ts` (GET) using `getUserRole(...)`.

### Production secrets and env vars

- **Template**: `.env.example`
- **Client-safe (public) env vars**:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (used in `lib/supabase/client.ts` and `lib/supabase/server.ts`)
  - `NEXT_PUBLIC_APP_URL` (used for OAuth redirect URI construction in `app/api/youtube/connect/*`)
- **Server-only secrets (must never reach the client bundle)**:
  - `SUPABASE_SERVICE_ROLE_KEY` (used in `lib/supabase/service.ts`)
  - `GEMINI_API_KEY` (used in `lib/services/ai-core.ts`)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (used in `app/api/webhooks/stripe/route.ts`)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (used in `app/api/youtube/connect/*`)

---

## System invariants

- **Service role must stay server-only**
  - Only use `createServiceClient()` from `lib/supabase/service.ts` inside server code.
  - Treat it as root access (bypasses RLS).

- **Every protected API route must enforce auth**
  - There is no repo-root `middleware.ts` currently enforcing API auth.
  - Pattern: `const supabase = await createClient(); const user = await requireAuth(supabase);`

- **Credits must be mutated atomically and idempotently**
  - Use `decrementCreditsAtomic(...)` in `lib/server/utils/credits.ts` (RPC `decrement_credits_atomic`).

- **Prompts/system instructions are server-side only**
  - Prompt construction should remain in route handlers (example: `app/api/generate/route.ts`).
  - Gemini calling code in `lib/services/ai-core.ts` should remain low-level and avoid embedding app prompt logic.

- **Never leak prompts/secrets via errors**
  - Use `sanitizeErrorForClient(...)` and `sanitizeApiErrorResponse(...)` from `lib/utils/error-sanitizer.ts`.
  - Prefer standardized API responses from `lib/server/utils/error-handler.ts`.

- **Redirects must be allowlisted**
  - Use `getAllowedRedirect(...)` from `lib/utils/redirect-allowlist.ts` (example usage: `app/auth/callback/route.ts`).

---

## How to safely modify the system

### Where to add new routes/features

- **New API route**
  - Add `app/api/<feature>/route.ts` (or nested segments).
  - Copy the structure from `app/api/thumbnails/route.ts`:
    - `createClient()` → `requireAuth(...)`
    - parse + validate inputs (`parseQueryParams(...)` or zod patterns used elsewhere)
    - do DB work through Supabase client (RLS)
    - return standardized errors (`lib/server/utils/error-handler.ts`) and/or `handleApiError(...)`

- **New client feature**
  - Put API calls in `lib/services/<feature>.ts`.
  - Wrap with a React Query hook in `lib/hooks/use<Feature>.ts`.
  - Keep components mostly “coordination” code in `components/**`.

### How to avoid leaking secrets or prompts

- **Secrets**
  - Never add secrets to `NEXT_PUBLIC_*`.
  - Only read secrets inside server routes or server-only modules.

- **Prompts**
  - Build prompts in the route handler that owns the feature (e.g. generation prompt in `app/api/generate/route.ts`).
  - If you must share prompt logic, put it under `lib/server/**` to avoid accidental client imports.

- **Logging**
  - Do not log prompts, tokens, or base64 images.
  - When logging third-party failures, sanitize error bodies via `sanitizeApiErrorResponse(...)`.

### How to validate changes

- **Lint**: `npm run lint`
- **Typecheck**: `npm run typecheck`
- **Tests**: `npm run test:run`
- **Performance/network score** (when UI/network changes): `npm run score`

Manual smoke tests I expect for risky work:

- Auth: sign in/out; API routes return 401 when unauthenticated.
- Generate: credits deducted only on success; retries don’t double-charge.
- Stripe: webhook signature verification and idempotency (`stripe_webhook_events`) behave.
- YouTube: state cookie prevents CSRF; tokens persist in `youtube_integrations`.

---

## Known gaps and assumptions

- **Server auth hydration wiring appears incomplete**
  - `app/layout.tsx` passes `initialAuthState` to `Providers`, but `app/providers.tsx` currently only accepts `{ children }` and does not pass initial state into `AuthProvider` (`lib/hooks/useAuth.tsx`). This suggests the intended “no auth flicker” bootstrap may not currently be active.

- **Schema exports are explicitly incomplete**
  - `supabase/tables/SCHEMA_SUMMARY.md` states the schema is inferred and “complete schema (constraints, indexes, RLS policies) needs to be fetched.” Treat `supabase/migrations/**` plus the live Supabase project as the authoritative source.

- **No repo-root `middleware.ts`**
  - There is no `middleware.ts` file in the repository root. Route protection must therefore be enforced per-route (API) and/or per-page layout patterns (UI).

- **Local-only “agent log” instrumentation exists in `app/auth/callback/route.ts`**
  - That file contains `fetch('http://127.0.0.1:7250/ingest/...')` blocks. From repo state alone, it’s unclear whether this is intended to run in production.

- **Env var validation is distributed**
  - Some routes validate config (Stripe webhook checks `STRIPE_WEBHOOK_SECRET`), while others throw deeper (Gemini key check is inside `lib/services/ai-core.ts`). There is no single centralized env validation module.

---

*End of system understanding document.*

