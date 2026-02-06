# Type: New Feature Brainstorm (Technical / Principal Architect)

**Product:** ViewBait — AI-powered thumbnails for creators  
**Date:** 2025-02-05  
**Lens:** Principal Software Architect — system performance, latency, throughput, scalability, modularity, technical debt, and maintainability.

This document proposes technical features and infrastructure improvements that directly support reliability, scale, and long-term maintainability of the ViewBait stack (Next.js 16, Supabase, Stripe, Gemini). Each item is grounded in the existing codebase and docs (`optimization_principles.md`, `studio_request_optimization.md`, `master_plan.md`, server utils, and API patterns).

---

## Overview

| # | Feature | Problem | Key benefit | Effort (est.) | Tier / gate | Status |
|---|---------|---------|-------------|---------------|-------------|--------|
| 1 | Distributed rate limit & cache (Redis/Upstash) | In-memory rate limit and LRU caches are per serverless instance; limits and cache are not shared across instances | 🔴 Consistent rate limiting and cache hit rates at scale; predictable cost control | Medium | n/a (infra) | O |
| 2 | Studio bootstrap / request coalescing API | Multiple parallel client calls on studio load (thumbnails, styles, palettes, projects, subscription) increase round-trips and TTI | ✅ Fewer round-trips, lower TTI, single place to add caching and prioritization | Medium | n/a | O |
| 3 | Generate pipeline resilience & parallelism | Reference/face image fetches in ai-core are sequential; single long Gemini call blocks the response; no queue for cost spikes | 💡 Lower P95 latency for generate; protection against traffic spikes and cost overruns | High | n/a | O |
| 4 | Gallery virtualization & list performance | Large thumbnail lists can cause heavy DOM and re-renders; cursor pagination exists but client may still render hundreds of items | ✅ Bounded DOM and smooth scroll for power users with large galleries | Low–Medium | n/a | O |
| 5 | Lightweight observability & performance baseline | No structured metrics for TTFB, generate duration, or error rates; limits ability to set SLOs and detect regressions | ⚠️ Data-driven optimization and incident response; foundation for SLOs | Medium | n/a | O |

**Status legend:** ✔ Done | ❌ Not doing | **O** To be / planned

---

## O 1. Distributed rate limit & cache (Redis/Upstash)

**Status:** O — To be / planned

### Problem it solves

`lib/server/utils/rate-limit.ts` and `lib/server/utils/lru-cache.ts` use in-memory structures. In serverless (e.g. Vercel), each instance has its own memory; rate limits can be bypassed by hitting different instances, and caches (e.g. subscription tier, profile) are cold per instance, increasing DB and latency variance.

### How it works

- **Rate limit:** Replace or back the existing `checkRateLimit()` with a Redis/Upstash-backed implementation (e.g. sliding window or fixed window per key). Keep the same API so route handlers do not change contract.
- **Cache:** Introduce an optional Redis layer for high-read, low-write data (e.g. subscription tier, public styles/palettes). Use `getCached()`-style API with Redis as backend when `REDIS_URL` or similar is set; fallback to existing in-memory LRU when not set so local dev stays simple.
- **Configuration:** Env vars for Redis connection; feature flag or env check to enable distributed path in production only.

### Core benefits

- **System:** 🔴 Consistent rate limiting across all instances; reduced DB load and more predictable latency from shared cache.
- **Business:** Prevents abuse and cost spikes; better scalability without changing app semantics.

### Technical considerations

- **Dependencies:** Add Redis client (e.g. `ioredis`, or Upstash REST if serverless-friendly).
- **Latency:** Redis round-trip adds ~1–2 ms; use for endpoints where consistency and cache hit rate matter more than single-digit ms (e.g. tier checks, rate limits).
- **Fallback:** Keep in-memory behavior when Redis is not configured; document in `optimization_principles.md` or a new `docs/caching_and_rate_limits.md`.

### Alignment with product vision

Supports Master Plan Phase 3 (“Performance & reliability”) and technical discipline (one source of truth for limits and tier; no client-side trust). Reduces technical debt around “per-instance” assumptions.

---

## O 2. Studio bootstrap / request coalescing API

**Status:** O — To be / planned

### Problem it solves

Studio load triggers several independent client requests (thumbnails, styles, palettes, projects, subscription, etc.). Each is a separate round-trip and parse; waterfalls or parallel bursts increase TTI and make it harder to apply a single cache or priority policy for “first paint” vs “deferred.”

### How it works

- **New endpoint:** e.g. `GET /api/studio/bootstrap` (or `POST` with body if needed) that returns a single JSON payload with: `thumbnails` (first page), `styles`, `palettes`, `projects`, `subscription` (or minimal tier/credits), and optionally `profile`. All fetched server-side in one request using existing server data layer and auth.
- **Client:** One call from Studio shell (or a dedicated `useStudioBootstrap` hook); populate React Query caches or equivalent from the payload so existing components keep using the same hooks/data shape.
- **Caching:** Apply cache headers (or ETag) to the bootstrap response as a whole; consider `private-user` with short max-age (e.g. 60s) so refreshes are cheap but not stale.

### Core benefits

- **Performance:** ✅ Fewer round-trips and lower TTI; single place to tune what is critical vs deferred.
- **Maintainability:** Clear “studio init” contract; easier to add new bootstrap data or A/B test loading strategies.

### Technical considerations

- **Auth:** Same as today: `requireAuth(supabase)`; bootstrap is user-scoped.
- **Size:** Limit thumbnail count in bootstrap (e.g. first page only); full list still via existing thumbnails API with cursor.
- **Compatibility:** Existing `/api/thumbnails`, `/api/styles`, etc. remain; bootstrap is an optional optimization. Gradual rollout: use bootstrap when available, fallback to current multi-request if not.

### Alignment with product vision

Directly supports “Speed Over Perfection” and Phase 3 performance; aligns with existing `studio_request_optimization.md` (reduce sequential and parallel request volume). No change to RLS or security model.

---

## O 3. Generate pipeline resilience & parallelism

**Status:** O — To be / planned

### How it works

- **Parallelism:** In `lib/services/ai-core.ts`, fetch all reference and face images in parallel (e.g. `Promise.all` over `fetchImageAsBase64` calls) instead of sequential `for` loops. Reduces P95 when multiple references/faces are used.
- **Resilience:** Existing retry/timeout in `retry-with-backoff` and `TimeoutError` handling in generate route — ensure timeouts are tuned for Gemini + image fetch sum; consider circuit-breaker or backpressure if Gemini is consistently slow (e.g. skip or delay non-critical generations).
- **Optional queue:** For cost and burst control, introduce an optional job queue (e.g. in-DB “generation_jobs” with a cron or worker that consumes and calls existing generate logic). Allows rate limiting per user and per system without blocking the HTTP response; UX can poll or use push for completion. Not required for MVP of this feature; parallelism and timeout tuning are the first step.

### Core benefits

- **Latency:** 💡 Lower P95 for generate when using multiple references/faces.
- **Reliability:** Fewer timeouts and better behavior under load; optional queue protects Gemini cost and availability.

### Technical considerations

- **Memory:** Parallel fetches increase peak memory per request; cap concurrent image fetches (e.g. 4–6) if needed.
- **Queue:** If implemented, use idempotency and existing `decrementCreditsAtomic` pattern so credits are deducted once and jobs are not duplicated. Align with `optimization_principles.md` (avoid long-running work in request path).

### Alignment with product vision

Phase 3 (“Performance & reliability”; “rate limits and cost controls on Gemini”). Reduces technical debt in the hottest path (generate) and keeps pipeline modular and testable.

---

## O 4. Gallery virtualization & list performance

**Status:** O — To be / planned

### Problem it solves

Users with hundreds of thumbnails may see slow scroll and high memory use if the gallery renders every item. Cursor pagination in `GET /api/thumbnails` already limits data; the remaining risk is client-side rendering of a large list without virtualization.

### How it works

- **Virtualization:** Use existing dependencies (`@tanstack/react-virtual` or `react-virtuoso` per `package.json`) in the studio gallery/list component so only visible items (plus a small overscan) are in the DOM. Integrate with existing thumbnails query (infinite scroll or “load more” with cursor).
- **Image loading:** Ensure thumbnails use lazy loading (e.g. `loading="lazy"` or intersection observer) so off-screen images do not block. Align with `optimization_principles.md` (virtualization for 100+ items; lazy load images).

### Core benefits

- **Performance:** ✅ Bounded DOM size and smooth scroll; lower memory and re-renders for power users.
- **Scalability:** Gallery remains usable as thumbnail count grows without changing API or pagination strategy.

### Technical considerations

- **Layout:** Masonry or grid with variable-height items may need a virtualization strategy that supports dynamic heights (e.g. Virtuoso’s dynamic size support or estimated height + measure).
- **Cursor pagination:** Keep using existing cursor-based API; virtualization is a client-side rendering optimization; optionally prefetch next page when user nears the end of the list.

### Alignment with product vision

Phase 3 performance; follows existing optimization principles. Low risk and high impact for users with large galleries.

---

## O 5. Lightweight observability & performance baseline

**Status:** O — To be / planned

### Problem it solves

Without structured metrics (TTFB, generate duration, error rates per route), optimization is guesswork and incidents are harder to diagnose. The codebase has logging (`lib/server/utils/logger.ts`) and error handling; what’s missing is a small, consistent metrics layer and a performance baseline.

### How it works

- **Metrics:** Add a thin metrics utility (e.g. timing for key operations: `GET /api/thumbnails`, `POST /api/generate`, auth resolution). Emit to a provider that fits the stack (e.g. Vercel Analytics, OpenTelemetry, or a simple log-based metric like “duration_ms” in structured logs). No need for full APM initially.
- **Baseline:** Run existing `npm run benchmark` (and Lighthouse if used) in CI or on release; record TTFB and key route timings; fail or warn if regressions exceed a threshold (e.g. generate P95 &gt; 60s).
- **SLOs:** Document target SLOs (e.g. generate success rate, P95 latency) in `docs/` and use metrics to track them; alert only when necessary to avoid noise.

### Core benefits

- **Operational:** ⚠️ Data-driven optimization and faster incident response; clear regression signal for performance.
- **Maintainability:** New features can be measured against the same baseline; reduces “it got slower” debates with data.

### Technical considerations

- **Overhead:** Keep metrics cheap (e.g. sample rate, or only critical routes); avoid blocking the request path.
- **Privacy:** Do not log PII or prompt content; stick to route name, status, duration, and maybe user id hash or tier for aggregates.
- **Vendor:** Prefer solutions that work in serverless (e.g. async flush, or log aggregation) so no long-lived connections.

### Alignment with product vision

Master Plan Phase 3 (“Performance & reliability”; “cron and webhook idempotency and alerting”). Supports technical discipline and sustainable scale.

---

*End of technical features brainstorm. Use the overview table for roadmap scans and the sections for implementation planning and prioritization.*
