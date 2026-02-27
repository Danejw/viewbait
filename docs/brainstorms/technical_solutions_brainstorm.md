## ViewBait Technical Solutions Brainstorm (Docs)

**Header**: Innovative but pragmatic technical solution approaches based on the current ViewBait architecture (Next.js App Router + Supabase + Gemini) and existing system constraints.

### Selected technical challenge: Make AI-heavy operations scalable, cost-controlled, and resilient

**Problem statement**

ViewBait increasingly relies on multiple **expensive and latency-sensitive AI workflows**:

- Thumbnail generation (`POST /api/generate`)
- YouTube video analysis (`POST /api/youtube/videos/analyze`) (Pro)
- Concept suggestions (`POST /api/youtube/videos/suggest-thumbnail-concepts`) (Pro)
- Attention heatmaps (`POST /api/thumbnails/heatmap`) (Advanced/Pro)
- Channel-fit checks (`POST /api/youtube/channel-consistency`)

Today, these operations are mostly **synchronous**, some are **not rate-limited**, and where rate limits exist they’re **in-memory per instance** (serverless replicas won’t share counters). Caching is often **client-side only** (e.g., studio provider caches), which can lead to:

- Duplicate AI calls across devices/sessions/users collaborating on the same project
- Cost spikes during traffic bursts or abuse scenarios
- P95 latency pain from long-running requests timing out
- “Thundering herd” behavior when many users hit the same expensive endpoint

This is a strong candidate for a “platform capability” investment because it improves reliability and cost control across multiple existing features and unlocks future AI features safely.

**Current constraints and patterns (from codebase)**

- Stack: Next.js (App Router), React 19, Supabase (RLS + service role for certain operations), Gemini calls in server-only `lib/services/ai-core.ts`.
- Existing rate limiting is **per-instance in-memory** (`lib/server/utils/rate-limit.ts`) and only some routes enforce it (e.g. `generate` does).
- Several AI routes are Pro/Advanced gated but **lack global coordination** (no shared cache/store for AI results).
- Some endpoints currently push heavy payloads from client to server (e.g., channel consistency uses client-supplied thumbnail URLs; concept suggestions send analytics from client).

---

### Approach A: Harden sync APIs with shared rate limits + server-side caching + dedupe (lowest lift)

**Concise title**: “Shared rate limit + cache-aside + request coalescing”

**What this addresses**

Reduce duplicated AI calls and cost spikes while keeping the existing synchronous UX and API surface mostly intact.

**Favored technical approach (detailed)**

1. **Add shared-store rate limiting for expensive routes**
   - Swap the in-memory limiter to a shared store (e.g., Redis/Upstash) behind the existing `enforceRateLimit()` API.
   - Extend `RATE_LIMIT_CONFIG` with route IDs for:
     - `youtube-analyze`, `youtube-suggest-concepts`, `thumbnail-heatmap`, `channel-consistency`
   - Enforce rate limiting in the corresponding API routes (consistent 429 behavior).

2. **Add server-side cache tables for AI results (cache-aside)**
   - Create a small set of tables for computed results, keyed by stable inputs:
     - `youtube_video_analyses` keyed by `(user_id, video_id, schema_version)`
     - `youtube_thumbnail_concepts` keyed by `(user_id, video_id, analytics_hash, prompt_version)`
     - `thumbnail_heatmaps` keyed by `(user_id, thumbnail_id)` or `(image_hash, dimensions)` where `image_hash = sha256(image_bytes)`
     - `channel_consistency_results` keyed by `(user_id, video_id, target_thumbnail_hash, refs_hash, prompt_version)`
   - Store `created_at`, `expires_at` (TTL), and the result JSON/base64 (or store in Supabase Storage for larger payloads).

3. **Request coalescing (“single-flight”) to prevent thundering herds**
   - When a cache miss occurs, write a row with `status = processing` and a unique constraint on the cache key.
   - If another request hits while processing, either:
     - return `202 Accepted` with a `request_id` to poll a lightweight status endpoint, or
     - long-poll briefly (e.g., up to 2–5 seconds) and return if completed.

4. **Version prompts and schemas explicitly**
   - Add `prompt_version` / `schema_version` constants to cache keys so improvements don’t poison caches.

**Architectural implications**

- Minimal front-end changes if you keep sync responses for most cases.
- Adds a “server-state truth” layer for AI results (DB/Storage), reducing reliance on client-only caches.
- Centralizes cost control via shared rate limits, consistent with `docs/api-rate-limits.md`.

**Benefits**

- **Cost control**: reduced duplicate AI calls; better abuse resistance.
- **Reliability**: fewer timeouts via dedupe; can return cached results quickly.
- **Maintainability**: encapsulated behind API routes and `enforceRateLimit()` / server data helpers.

**Complexity & risks**

- **Complexity**: Low → Medium (days). Mostly schema + a few route updates.
- **Risks**
  - Cache invalidation/versioning mistakes could serve stale or mismatched results.
  - Storing large heatmap payloads in DB is risky; prefer Storage + signed URLs.
  - Requires adding and operating a shared limiter backend (Upstash/Redis).

---

### Approach B: Introduce an async “AI Jobs” pipeline (most robust, still pragmatic)

**Concise title**: “DB-backed job queue + polling + worker”

**What this addresses**

Make expensive AI tasks resilient to serverless request time limits and provide a consistent execution model for current and future AI features.

**Favored technical approach (detailed)**

1. **Create a unified jobs table**
   - `ai_jobs` with fields like:
     - `id`, `user_id`, `job_type` (`youtube_analyze`, `heatmap`, `channel_consistency`, `generate_variations`, etc.)
     - `status` (`queued`, `running`, `succeeded`, `failed`, `cancelled`)
     - `input` JSON (validated), `result` JSON (or storage pointer), `error` (sanitized)
     - `idempotency_key` (unique) for dedupe
     - `created_at`, `started_at`, `completed_at`, `expires_at`
   - Add indexes on `(user_id, status, created_at)` and `idempotency_key`.

2. **Change heavy routes to enqueue instead of compute**
   - Replace synchronous work with:
     - `POST /api/ai/jobs` → returns `{ jobId }`
     - `GET /api/ai/jobs/:id` → returns status + result when ready
   - Keep backward compatibility by allowing the old endpoint to:
     - enqueue and then (optionally) long-poll for a short time to return immediate results when fast.

3. **Worker execution model**
   - Start with minimal infra:
     - A secured cron-driven worker route (e.g., `app/api/cron/process-ai-jobs/route.ts`) that claims jobs and processes them.
     - Claim jobs atomically with Postgres semantics (e.g., `UPDATE ... WHERE status='queued' ... RETURNING *`) and a `locked_until` lease.
   - Later, graduate to a dedicated worker (container/Cloud Run) without changing the job contract.

4. **Observability + cost protection**
   - Persist durations, retries, and outcome metrics per job type.
   - Add per-tier concurrency limits (e.g., max simultaneous jobs/user).

**Architectural implications**

- Introduces a stable asynchronous contract used by multiple features.
- Provides a single place to implement retries/backoff, cancellation, and dedupe.
- Requires UI patterns for “pending/running” states (some already exist, e.g., analyzing spinners).

**Benefits**

- **Resilience**: avoids request timeout failures for long-running AI calls.
- **Scalability**: allows controlled concurrency and retry policies.
- **Extensibility**: new AI features become “new job types,” not bespoke endpoints.

**Complexity & risks**

- **Complexity**: Medium → High (weeks) depending on worker choice and UX updates.
- **Risks**
  - Cron-based workers may introduce latency (jobs don’t start instantly).
  - Requires careful auth/RLS design: jobs should be user-scoped; worker may need service role.
  - Needs tight controls to prevent runaway retries and cost blowups.

---

### Approach C: Managed queue + dedicated workers (highest scale, more infra)

**Concise title**: “Queue service + worker fleet”

**What this addresses**

Handle high throughput and real-time job execution with strong global rate limiting and concurrency control.

**Favored technical approach (detailed)**

- Use a managed queue and scheduler (e.g., Upstash QStash/Redis, or a cloud queue) and run one or more workers that:
  - Pull tasks, execute Gemini calls, store results to DB/Storage, emit events.
- Keep the same `ai_jobs` table contract from Approach B, but move dispatch/claiming into the queue system.
- Add distributed rate limiting + concurrency (per user/tier) in the queue layer.

**Architectural implications**

- Introduces new infrastructure and operational overhead.
- Strong separation between API (enqueue/poll) and worker execution.

**Benefits**

- **Throughput**: better handling of spikes and high concurrency.
- **Reliability**: queue semantics (retries, DLQ) reduce failure impact.
- **Predictable cost**: central concurrency + global rate limits.

**Complexity & risks**

- **Complexity**: High (weeks+).
- **Risks**
  - Requires new vendor(s), secrets, monitoring, and deployment surface area.
  - More moving parts increases incident surface if not staffed appropriately.

---

### Recommendation (pragmatic path)

- **Short-term (days)**: Implement **Approach A** (shared rate limiting + server-side caching + dedupe) for the most expensive non-generate routes first (YouTube analyze, heatmap).
- **Medium-term (weeks)**: Build **Approach B** as the long-term execution model for AI tasks, migrating endpoints incrementally.
- **Only if needed**: Move to **Approach C** when traffic/latency demands it and the team can support extra infra.

