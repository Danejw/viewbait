# Critique: Voice + Chat YouTube AI Assistant Plan

Senior-engineer review of the strategy document at `voice_chat_youtube_ai_assistant_228b2677.plan.md` (Real-Time Voice + Chat YouTube AI Assistant), evaluated against the ViewBait codebase.

---

## High-level overview (plain language)

The strategy is **sound and well aligned** with the app: it reuses existing auth (`requireAuth`), tier resolution (`getTierNameForUser`), YouTube service and OAuth, and the same error-code patterns (`TIER_REQUIRED`, `NOT_CONNECTED`) already used by YouTube routes. The split between client (Live API WebSocket + UI) and backend (execute-tool, live-token) keeps secrets server-side and fits a serverless-friendly model.

**Main gaps:** (1) **Ephemeral token availability** for Gemini Live API is not confirmed—Google’s docs may expose session creation or token issuance differently (e.g. API key in header vs. short-lived token). The plan should call out a concrete verification step and fallback to “text-only agent with existing chat route” if Live tokens are unavailable. (2) **Server WebSocket proxy** is presented as an alternative but is a poor fit for **serverless** (Vercel, etc.): long-lived WebSockets are not supported in standard Route Handlers. The critique recommends treating the proxy as “custom server or separate service only” and prioritizing the ephemeral-token path. (3) **Client tier gating** should explicitly use `useSubscription().tier === 'pro'` (and optionally `openCheckout` / SubscriptionModal) so the assistant entry point matches existing patterns in [studio-sidebar.tsx](viewbait/components/studio/studio-sidebar.tsx) and [studio-views.tsx](viewbait/components/studio/studio-views.tsx). (4) **Execute-tool allowlist and param validation** are mentioned but not specified—recommend a single registry (tool name → handler + schema) to avoid drift and ensure every tool is validated. (5) **Route placement** for `/studio/assistant`: middleware already protects `/studio` and redirects unauthenticated users; add `/studio/assistant` to the same protection and document that **tier** is enforced in the page (or a layout) via subscription check, not in middleware (to avoid extra DB/cache lookups on every request).

**Verdict:** Proceed with the plan after verifying Live API token/session mechanics, dropping serverless WebSocket proxy as a default alternative, and tightening execute-tool and client-gating details.

---

## Summary table

| Area | Verdict | Notes |
|------|--------|--------|
| **Overall strategy** | ✔ | Reuses auth, tier, YouTube service, and error codes; clear separation of client vs backend. |
| **Auth & tier** | ✔ | `requireAuth`, `getTierNameForUser`, `isYouTubeConnected` align with [lib/server/utils/tier.ts](viewbait/lib/server/utils/tier.ts) and existing YouTube routes. |
| **Execute-tool design** | ✔ | Single POST endpoint, allowlist, user-scoped execution; matches existing [error-handler](viewbait/lib/server/utils/error-handler.ts) codes (`FORBIDDEN`, `VALIDATION_ERROR`). |
| **Error codes** | ✔ | `NOT_CONNECTED`, `TIER_REQUIRED` already used in [app/api/youtube](viewbait/app/api/youtube); execute-tool should return the same for consistency. |
| **Ephemeral token** | ⚠ | Plan depends on Google issuing a short-lived token for Live API; exact API is not confirmed. Verify with current Gemini Live docs and add fallback (e.g. text-only agent) if unavailable. |
| **Server WebSocket proxy** | ❌ | Long-lived WebSockets are not supported in Next.js App Router Route Handlers on serverless. Treat proxy only as custom server or separate service. |
| **Client tier gating** | ⚠ | Plan says “gate with tierName === 'pro'” but does not name the hook. Use `useSubscription().tier === 'pro'` and existing SubscriptionModal for consistency. |
| **Execute-tool allowlist** | ⚠ | Plan says “validate tool against allowlist” but not how. Recommend a single registry: tool name → handler + param schema (e.g. Zod) for validation and no drift. |
| **/studio/assistant route** | ✔ | Fits under existing `/studio` protection in [middleware.ts](viewbait/middleware.ts). Document that Pro check is in page/layout via useSubscription, not middleware. |
| **YouTube search/comments** | ✔ | Adding search.list and optional commentThreads.list in [lib/services/youtube.ts](viewbait/lib/services/youtube.ts) matches existing service style. |
| **Metrics & logging** | ✔ | Using [lib/server/utils/logger](viewbait/lib/server/utils/logger) and structured logs (no PII) is consistent. |
| **Security (secrets, allowlist)** | ✔ | Keys server-side; execute-tool with allowlist and user context is correct. |
| **Data cards / UI reuse** | ✔ | Reusing patterns from [youtube-video-analytics-modal.tsx](viewbait/components/studio/youtube-video-analytics-modal.tsx) and subscription modal is appropriate. |

---

## Detailed critique

### ✔ Strengths

- **Reuse:** Auth (`requireAuth`), tier (`getTierNameForUser`), YouTube (`lib/services/youtube.ts`), and error codes (`TIER_REQUIRED`, `NOT_CONNECTED`) are already used in [app/api/youtube](viewbait/app/api/youtube). The plan correctly extends these instead of introducing new patterns.
- **Security:** API keys and OAuth stay on the server; Live API access via token or proxy keeps the client untrusted. Execute-tool running with authenticated user and allowlist is the right model.
- **Scope:** Pro-only voice assistant and YouTube tools (Data + Analytics) are clearly scoped; optional comments and search are called out.
- **Edge cases:** Channel not connected, rate limits, and unavailable analytics are addressed with stable codes and model instructions.

### ❌ Critical: Server WebSocket proxy and serverless

The plan suggests a “server WebSocket proxy” as an alternative if ephemeral tokens are complex. **Next.js App Router Route Handlers do not support long-lived WebSockets** in a serverless environment (e.g. Vercel). A proxy would require either:

- A **custom Node server** (e.g. `server.js`) that handles both HTTP and WebSocket, or  
- A **separate WebSocket service** (e.g. another host or edge function with WebSocket support).

**Recommendation:** Do not present the proxy as a drop-in alternative. Prefer **(1) client → Live API with ephemeral token** as the primary path, **(2) verify token/session API with current Gemini Live docs**, and **(3)** if no token is available, consider a **text-only MVP** using the existing [app/api/assistant/chat/route.ts](viewbait/app/api/assistant/chat/route.ts) plus the new execute-tool for YouTube (no voice until Live API token or a non-serverless proxy is viable).

### ⚠ Ephemeral token verification

The plan assumes Google provides a way to issue a short-lived token for the Live API so the client can connect without the API key. **The exact mechanism (endpoint, request shape, expiry) should be verified** against the latest:

- [Get started with Live API](https://ai.google.dev/gemini-api/docs/live)  
- [Vertex Live API WebSocket](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/get-started-websocket)

If the only option is passing the API key in the client (e.g. in a header), that is unacceptable for production; the plan should then explicitly choose “text-only agent + execute-tool” for MVP and defer voice until a server-side token or a non-serverless proxy is available.

### ⚠ Client-side Pro gating

The plan says to “gate the entry with tierName === 'pro'” but does not specify how. The codebase already gates features by subscription in the studio using **`useSubscription()`** from [lib/hooks/useSubscription.tsx](viewbait/lib/hooks/useSubscription.tsx) (e.g. [studio-sidebar.tsx](viewbait/components/studio/studio-sidebar.tsx), [studio-views.tsx](viewbait/components/studio/studio-views.tsx)). **Recommendation:** Gate the assistant entry (nav link, route, or modal) with `useSubscription().tier === 'pro'`. If the user is not Pro, show an upgrade CTA and open the existing **SubscriptionModal** (same pattern as “Upgrade to Pro” in chat and sidebar). Do not add tier to middleware for `/studio/assistant`; keep middleware auth-only and do tier checks in the page/layout to avoid extra DB/cache on every request.

### ⚠ Execute-tool allowlist and param validation

The plan says “validate tool against allowlist” and “validate params” but does not define the shape. To avoid drift and ensure every tool is validated:

- **Recommendation:** Maintain a **single registry** in the execute-tool route (or a small module): `Record<string, { handler: (userId, params) => Promise<unknown>, schema: ZodSchema }>`. The route (1) looks up the tool, (2) parses/validates params with the schema, (3) runs the handler with the authenticated user id. Add new tools by adding one entry; no ad-hoc conditionals.

### 💡 Minor suggestions

- **Tool response size:** Some tools (e.g. list_my_videos with many items, or analytics time series) can return large JSON. Consider a **max result size or pagination** in the tool contract so the model receives concise answers and the client does not choke on huge payloads.
- **Rate limiting:** The plan mentions logging; consider **rate limiting** on `POST /api/agent/execute-tool` and `POST /api/agent/live-token` (e.g. per user per minute) to avoid abuse and control YouTube API quota.
- **Single source of “YouTube = Pro”:** The codebase already uses `getTierNameForUser` and `tierName === 'pro'` for YouTube. Keep this as the single rule; do not introduce a separate capability flag unless you centralize it (e.g. in [subscription-tiers](viewbait/lib/constants/subscription-tiers.ts) or DB) and use it everywhere.

---

## Alternative considered

**Text-first MVP without Live API voice:**  
If ephemeral tokens for Gemini Live are not available or are high-friction, ship a **Pro-only “YouTube assistant”** that reuses the existing chat route pattern: user sends text (no voice), backend calls Gemini with the same execute-tool tools, and returns streamed text + tool results. The UI would be a dedicated chat view (e.g. `/studio/assistant`) with message list and data cards, but no mic/speaker. Voice can be added later when Live API token or a dedicated WebSocket service is in place. This reduces risk and delivers YouTube Q&A and analytics sooner.

---

## Recommendation

- **Proceed** with the plan after:
  1. **Verifying** Gemini Live API token/session mechanics and documenting the chosen path (ephemeral token vs. text-only MVP).
  2. **Removing** the server WebSocket proxy as a default serverless option; document it only for custom server or separate service.
  3. **Specifying** client gating: `useSubscription().tier === 'pro'` and existing SubscriptionModal for upgrade.
  4. **Defining** execute-tool as a registry (tool name → handler + schema) for allowlist and param validation.
- **During implementation:** Add a short “Assistant” section to [docs/chat_implementation.md](viewbait/docs/chat_implementation.md) or a new `docs/assistant_implementation.md` describing the voice/text flow, execute-tool contract, and Pro/YouTube gating so future changes stay consistent.
