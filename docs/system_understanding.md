# System Understanding (Onboarding Lead Engineer)

**Version:** 2026-02-13T20:53:14Z  
**Repository:** `viewbait` (Next.js App Router + Supabase + Stripe + Gemini)

This document is written as an onboarding lead engineer’s “system map”. It traces *real* execution paths and calls out the exact files and functions that enforce security, tenancy, and product behavior.

---

## 1. End-to-end data flow narrative (UI → server → Supabase → return)

### 1.1 Browser request lifecycle and auth gate

**Protected navigation to Studio**

- **Request:** `GET /studio`
- **Auth gate:** `middleware()` in `middleware.ts`
  - Route protection is configured by `PROTECTED_ROUTES` and `AUTH_ROUTES`.
  - Session is resolved via `createServerClient()` from `@supabase/ssr` inside `middleware()` and `supabase.auth.getUser()` (same function).
  - Redirect behaviors:
    - Unauthed access to protected routes → redirect to `/auth` with `redirect` query param.
    - Authed access to auth pages (`/auth`, except `/auth/reset-password` and `/auth/callback`) → redirect to `/studio` or requested `redirect`.
  - Onboarding enforcement:
    - Authed access to `/studio` triggers a read of `profiles.onboarding_completed` via `supabase.from('profiles').select('onboarding_completed')...` inside `middleware()`.
    - If not completed → redirect to `/onboarding` while preserving Supabase cookies (see the explicit cookie copy at lines 125–129 of `middleware.ts`).

**App shell and providers**

- **Layout:** `RootLayout()` in `app/layout.tsx` renders `Providers` from `app/providers.tsx`.
- **Providers:** `Providers()` in `app/providers.tsx` initializes:
  - `QueryClientProvider` (React Query) with default query settings.
  - `AuthProvider` from `lib/hooks/useAuth.tsx`.
  - `SubscriptionProvider` from `lib/hooks/useSubscription.tsx`.

**Client auth state initialization**

- `AuthProvider()` in `lib/hooks/useAuth.tsx`:
  - Determines configuration via `isSupabaseConfigured()`.
  - Fetches the client session via `supabase.auth.getSession()` after dynamically importing `createClient()` from `lib/supabase/client.ts`.
  - Sets up the auth event listener via `supabase.auth.onAuthStateChange(...)`.
  - Fetches the user profile via `getProfile()` from `lib/services/profiles` (service calls API route; see section 1.4).

### 1.2 Studio “list thumbnails” flow (gallery/results) with signed URLs

This is the canonical “read flow” demonstrating UI → service → route → Supabase → storage signed URLs → response.

- **UI state container:** `StudioProvider()` in `components/studio/studio-provider.tsx`
  - Uses `useThumbnails()` from `lib/hooks/useThumbnails.ts` to fetch paginated thumbnails.
- **Hook:** `useThumbnails()` in `lib/hooks/useThumbnails.ts`
  - Calls service function `getThumbnails()` from `lib/services/thumbnails.ts`.
- **Client service:** `getThumbnails()` in `lib/services/thumbnails.ts`
  - Issues `fetch('/api/thumbnails?...')`.
- **Route handler:** `GET()` in `app/api/thumbnails/route.ts`
  - Creates a cookie-backed Supabase server client via `createClient()` in `lib/supabase/server.ts`.
  - Enforces auth via `requireAuth(supabase)` in `lib/server/utils/auth.ts` (throws `NextResponse.json(..., 401)`).
  - Builds query via `buildThumbnailsQuery()` in `lib/server/data/thumbnails.ts` and pagination via `applyCursorPagination()` in `lib/server/utils/query-builder.ts`.
  - Refreshes signed storage URLs via `refreshThumbnailUrls()` in `lib/server/utils/url-refresh.ts`.
  - Returns a user-private cached response via `createCachedResponse()` in `lib/server/utils/cache-headers.ts`.

**Key Supabase boundaries**

- All reads occur through the *anon key + user session* server client (`lib/supabase/server.ts`) so **RLS is enforced**.
- RLS policies for core tables are defined in `supabase/migrations/006_rls_core_tables.sql` (see `thumbnails_*_policy`, `profiles_*_policy`, etc.).

### 1.3 Studio “generate thumbnail” flow (Gemini → Storage → DB → credits)

This is the canonical “write flow” demonstrating server-only secret usage and credit gating.

- **UI event:** `generateThumbnails()` action inside `StudioProvider()` (`components/studio/studio-provider.tsx`)
  - Delegates API calling + optimistic skeletons to `useThumbnailGeneration()` in `lib/hooks/useThumbnailGeneration.ts`.
- **Client hook:** `generate()` in `lib/hooks/useThumbnailGeneration.ts`
  - Calls `generateThumbnail()` service in `lib/services/thumbnails.ts` which posts to `POST /api/generate`.
- **Route handler:** `POST()` in `app/api/generate/route.ts`
  - Auth: `createClient()` → `requireAuth()`.
  - Tier gates: `getTierForUser()` in `lib/server/utils/tier.ts` and tier config from `lib/server/data/subscription-tiers`.
  - Prompt construction happens **in this route** (see `promptData` and `prompt` built near the middle of the file).
  - Calls Gemini via `callGeminiImageGeneration()` in `lib/services/ai-core.ts` using server-only `process.env.GEMINI_API_KEY`.
  - Stores images in Supabase Storage (`supabase.storage.from('thumbnails').upload(...)`) and creates signed URLs (`createSignedUrl(..., SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS)` from `lib/server/utils/url-refresh.ts`).
  - Writes DB updates through the cookie-backed client (`supabase.from('thumbnails')...`) so RLS still applies.
  - Deducts credits via `decrementCreditsAtomic()` in `lib/server/utils/credits.ts` with a service-role client created by `createServiceClient()` in `lib/supabase/service.ts`.

### 1.4 Assistant-driven generator (streaming SSE) flow

This system uses an AI tool schema to return *structured UI instructions* that drive the same Studio form state.

- **UI:** `StudioChatPanel` in `components/studio/studio-chat.tsx`
  - Sends streaming request `fetch('/api/assistant/chat?stream=true', ...)` in `handleSend()`.
  - Parses SSE events and applies updates via `applyFormStateUpdates()` from `StudioProvider()`; UI sections render via `DynamicUIRenderer` in `components/studio/dynamic-ui-renderer.tsx`.
- **Route handler:** `POST()` in `app/api/assistant/chat/route.ts`
  - Auth: uses `getOptionalAuth()` but immediately rejects unauthenticated users in this route (returns 401 when `!user`).
  - Builds a large server-side system prompt string (`systemPrompt`) and calls Gemini function calling via `callGeminiWithFunctionCalling()` in `lib/services/ai-core.ts`.
  - For attached images, uploads them to private buckets (`style-references`, `faces`) using `uploadBase64ToStyleReferences()` / `uploadBase64ToFaceImage()` and signed URLs with `SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS`.
  - Strips server-only keys from updates via `stripServerOnlyFormUpdates()` before returning JSON/SSE.

### 1.5 YouTube integration and “agent” assistant flows

There are two distinct AI-assisted systems:

1) **Studio thumbnail assistant**: `POST /api/assistant/chat` (above) drives generator UI.

2) **YouTube “agent” assistant**: `POST /api/agent/chat` and `POST /api/agent/execute-tool`

- **UI:** `StudioAssistantPanel` in `components/studio/studio-assistant-panel.tsx` calls `POST /api/agent/chat`.
- **Route handler:** `POST()` in `app/api/agent/chat/route.ts`
  - Enforces Pro tier via `getTierNameForUser()` (`lib/server/utils/tier.ts`).
  - Calls Gemini and executes tool calls using the allowlisted registry `AGENT_TOOL_REGISTRY` in `lib/server/agent/tool-registry.ts`.
- **Tool execution endpoint:** `POST()` in `app/api/agent/execute-tool/route.ts`
  - Validates tool name against `AGENT_TOOL_NAMES`.
  - Enforces “Pro + connected” for tools where `requiresYouTube: true`.

**OAuth callback token persistence**

- **Route handler:** `GET()` in `app/auth/callback/route.ts`
  - Exchanges Supabase OAuth code via `supabase.auth.exchangeCodeForSession(code)` using `createClient()` (`lib/supabase/server.ts`).
  - Persists Google provider tokens to `youtube_integrations` via `persistYouTubeTokens()` which uses `createServiceClient()` (`lib/supabase/service.ts`).

### 1.6 Stripe webhook flow (service-role writes)

- **Route handler:** `POST()` in `app/api/webhooks/stripe/route.ts`
  - Verifies signature using `stripe.webhooks.constructEvent(body, signature, webhookSecret)`.
  - Uses `createServiceClient()` to bypass RLS for system writes (e.g. `stripe_webhook_events`, `user_subscriptions` updates inside helpers).
  - Enforces idempotency by checking `stripe_webhook_events.event_id` before processing and by tolerating unique constraint errors (`23505`) on insert.

---

## 2. Major subsystems and boundaries

### 2.1 Client layer (React, Studio SPA)

- **Entry pages**
  - Landing: `ViewBaitLanding()` in `app/page.tsx` uses `useAuth()` from `lib/hooks/useAuth.tsx` to route users to `/studio` or `/auth`.
  - Studio SPA: `StudioPage()` in `app/studio/page.tsx` wraps the entire studio in `StudioProvider()` (`components/studio/studio-provider.tsx`).
- **Studio state + orchestration**
  - `StudioProvider()` in `components/studio/studio-provider.tsx` is the “controller” for views, generator state, optimistic generation placeholders, and modals.
  - Generator UI: `StudioGenerator` in `components/studio/studio-generator.tsx`.
  - Assistant UI: `StudioChatPanel` in `components/studio/studio-chat.tsx` (thumbnail assistant) and `StudioAssistantPanel` in `components/studio/studio-assistant-panel.tsx` (YouTube agent assistant).

### 2.2 Server layer (Next.js route handlers)

- **Location:** `app/api/**/route.ts`
- **Auth pattern:** `createClient()` (`lib/supabase/server.ts`) + `requireAuth()` (`lib/server/utils/auth.ts`) at the top of protected routes.
- **Error + logging utilities**
  - Standard responses: `lib/server/utils/error-handler.ts`
  - Centralized API catch: `handleApiError()` in `lib/server/utils/api-helpers.ts`
  - PII-redacted structured logs: `logError()/logInfo()` in `lib/server/utils/logger.ts`
  - Prompt leakage prevention: `sanitizeErrorForClient()` / `sanitizeApiErrorResponse()` in `lib/utils/error-sanitizer.ts`

### 2.3 Data layer (Supabase Postgres + RLS + Storage)

- **Supabase clients**
  - Cookie-backed server client: `createClient()` in `lib/supabase/server.ts` (anon key + cookies; RLS applies).
  - Browser client: `createClient()` in `lib/supabase/client.ts` (anon key; RLS applies).
  - Service role client: `createServiceClient()` in `lib/supabase/service.ts` (**bypasses RLS; server-only**).
- **RLS source of truth**
  - Core RLS policies: `supabase/migrations/006_rls_core_tables.sql`
  - Notification RLS + RPC: `supabase/migrations/001_create_notifications.sql`
  - Profile admin flag: `supabase/migrations/002_add_profiles_is_admin.sql`
  - Onboarding flag: `supabase/migrations/005_add_profiles_onboarding_completed.sql`
- **Storage**
  - Signed URL refresh utilities: `lib/server/utils/url-refresh.ts`
  - Private upload route (enforces `path` starts with `user.id`): `POST()` in `app/api/storage/upload/route.ts`

---

## 3. “Source of truth” locations

### 3.1 Authentication (who is the user)

- **HTTP session truth:** Supabase auth cookies handled by:
  - `middleware()` in `middleware.ts` (SSR session refresh + redirects)
  - `createClient()` in `lib/supabase/server.ts` (cookie store from `next/headers`)
- **API auth truth:** `requireAuth()` / `getOptionalAuth()` in `lib/server/utils/auth.ts` (calls `supabase.auth.getUser()`).

### 3.2 Access control (what can they do)

- **Route-level navigation:** `middleware.ts` route checks + onboarding redirect.
- **API-level enforcement:** Each protected route handler calls `requireAuth()` explicitly.
- **Database enforcement:** RLS policies in `supabase/migrations/*.sql` are the hard boundary for user-scoped data.
- **Admin-only behavior:** Verified by reading `profiles.is_admin` (e.g. `POST /api/notifications/broadcast` in `app/api/notifications/broadcast/route.ts`), then performing inserts via `createServiceClient()`.
- **Tier gating:** `getTierForUser()` / `getTierNameForUser()` in `lib/server/utils/tier.ts` and client checks in `lib/hooks/useSubscription.tsx`.

### 3.3 Production secrets (what must never leak)

**Documented env template:** `.env.example`

- **Client-safe env vars**
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (used by `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `middleware.ts`)
- **Server-only env vars (never `NEXT_PUBLIC_*`)**
  - `SUPABASE_SERVICE_ROLE_KEY` (used only by `lib/supabase/service.ts`)
  - `GEMINI_API_KEY` (used by `lib/services/ai-core.ts` and agent/assistant routes)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (used by `app/api/webhooks/stripe/route.ts`)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (used implicitly for Supabase OAuth provider configuration; tokens persisted in `app/auth/callback/route.ts`)
  - `YOUTUBE_DATA_API_KEY` (used by YouTube services; see `.env.example`)

---

## 4. System invariants (must remain true)

- **Never use service role in the browser**
  - The only service-role client constructor is `createServiceClient()` in `lib/supabase/service.ts`. It must only be imported and called from server-only code (route handlers, server utilities).
- **RLS is the permission boundary for user data**
  - Route handlers are not allowed to “trust” client-provided identifiers like `user_id`; they must derive identity from `requireAuth()` and let DB policies enforce row access (see patterns in `app/api/thumbnails/route.ts`, `app/api/profiles/route.ts`).
- **Private storage paths are user-scoped**
  - `POST /api/storage/upload` enforces `path` starts with the authenticated user id (see `pathUserId !== user.id` check in `app/api/storage/upload/route.ts`).
- **Prompt and system instructions stay server-side**
  - `lib/services/ai-core.ts` explicitly says “NO PROMPTS”; prompts are composed in route handlers like `app/api/generate/route.ts` and `app/api/assistant/chat/route.ts`.
- **Error messages returned to clients must not leak prompts or secrets**
  - Sanitization helpers live in `lib/utils/error-sanitizer.ts` and are used by server responders in `lib/server/utils/error-handler.ts`.
- **Middleware must preserve Supabase cookies**
  - `middleware.ts` sets and returns `supabaseResponse`; any new response must copy cookies as described in the comments inside that file.

---

## 5. How to safely modify the system

### 5.1 Where to add new features

- **New UI feature**
  - Add/extend Studio UI in `components/studio/*` and wire state/actions via `StudioProvider()` in `components/studio/studio-provider.tsx`.
  - For server-backed data, create a service function in `lib/services/*` and a hook in `lib/hooks/*` (React Query) following the `getThumbnails()` / `useThumbnails()` pattern.
- **New API route**
  - Create `app/api/<feature>/route.ts`.
  - Use `createClient()` from `lib/supabase/server.ts` and call `requireAuth()` unless the route is explicitly public.
  - Use `handleApiError()` to centralize error logging + safe client responses.
- **New database capability**
  - Add a new SQL migration in `supabase/migrations/`.
  - Follow `docs/database_security_principles.md`: RLS on, ownership keys present, views/RPC for sensitive operations.

### 5.2 Avoid leaking secrets and prompts

- **Do not add secrets to `NEXT_PUBLIC_*`**
  - If code needs a secret, it must run in a route handler or server utility.
- **Keep AI prompt construction in server routes**
  - Follow the existing pattern: prompts are built in `app/api/generate/route.ts` and `app/api/assistant/chat/route.ts`, while `lib/services/ai-core.ts` is a low-level transport layer.
- **Be careful with logs**
  - Prefer `logInfo()/logError()` from `lib/server/utils/logger.ts` (PII redaction) over raw `console.log` in production code.

### 5.3 Validate changes (local quality gate)

- **Typecheck:** `npm run typecheck`
- **Lint:** `npm run lint`
- **Tests:** `npm run test:run` (Vitest; see `agentics/TESTING_CONSTITUTION.md`)
- **Manual smoke flows**
  - Auth redirects: `/auth` ↔ `/studio` (middleware behavior)
  - Studio list + pagination: thumbnails load and signed URLs render
  - Generation: `POST /api/generate` creates thumbnails, uploads to storage, returns signed URLs
  - Stripe webhook (if possible in a test env): signature verification + idempotency

---

## 6. Known gaps and assumptions (could not be fully confirmed from repo)

- **Credit RPC functions are referenced but not defined in migrations**
  - `lib/server/utils/credits.ts` calls `decrement_credits_atomic` and `increment_credits_atomic`, but there are no SQL definitions for these functions under `supabase/migrations/`. Assume they exist in the deployed database or are managed outside this repo.
- **Some table schemas are implied by code but not present in migrations**
  - Example: `stripe_webhook_events`, `youtube_integrations`, and tier tables used by `lib/server/data/subscription-tiers` are referenced in code but not created in the checked-in migrations listed in `supabase/migrations/`.
- **A client-side debug ingest call exists**
  - `lib/hooks/useThumbnailGeneration.ts` contains a `fetch('http://127.0.0.1:7250/ingest/...')` block guarded only by `.catch(() => {})`. This likely belongs to local debugging tooling and will fail silently in production environments.
- **Not all “public” access patterns were audited**
  - There are public endpoints like `GET /api/thumbnails/public` and shared-project flows (`app/api/projects/share/[slug]/route.ts`) that should be reviewed when tightening public data exposure.

---

*End of system understanding.*
