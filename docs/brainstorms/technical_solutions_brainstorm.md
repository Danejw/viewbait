## Type: Technical Solutions Brainstorm

This brainstorm focuses on a single technical challenge that will matter more as ViewBait scales: making AI-heavy operations reliable and cost controlled in multi-instance deployments while improving user experience for long-running work.

### Technical challenge selected
**Durable, scalable execution for AI operations** such as thumbnail generation, edits, heatmaps, and YouTube video analysis. Today many of these run as request-response API calls that can time out, retry awkwardly, and provide limited progress feedback. Rate limits are also per instance in the current in-memory limiter, which becomes less effective when scaling horizontally.

---

### Approach A (favored): Job queue with real-time progress updates
**Title**: Durable AI Job Pipeline with Progress

**Problem statement**: Long-running AI tasks (generation, analysis, edits) are sensitive to timeouts and transient provider failures. Users also benefit from progress states (queued, running, uploading, ready) instead of a single blocking spinner.

**Favored approach**:
- **Persist jobs** in a dedicated table (Supabase Postgres) such as `ai_jobs` with fields like `id`, `user_id`, `type`, `status`, `input_json`, `result_json`, `error`, `created_at`, `started_at`, `finished_at`, `idempotency_key`.
- **Enqueue from API routes** quickly (fast response) and return a `job_id`.
- **Run workers** that pull jobs and execute the heavy work:
  - Option 1: a small Node worker service (separate from Next) deployed on a lightweight runtime.
  - Option 2: scheduled workers triggered via cron or a queue service.
- **Progress and UI updates**:
  - Write progress events to `ai_job_events` or update `ai_jobs.status` with step metadata.
  - Client subscribes via Supabase realtime (or polls) to show status and results as soon as ready.
- **Cost controls and safety**:
  - Apply per-user global rate limiting at enqueue time (with a shared store, see Approach C).
  - Enforce idempotency keys so double clicks do not double charge credits.
  - Centralize retry policy and provider fallbacks inside workers, not inside request handlers.

**Architectural implications**:
- Introduces a background execution layer and a stable contract (`job_id`) between UI and server.
- Shifts AI providers and storage uploads out of the request lifecycle for better reliability.
- Requires clear cancellation and retention policy for jobs and events.

**Benefits**:
- Higher success rate for AI operations (fewer timeouts, better retries).
- Better UX with predictable progress states and resumability.
- Easier to implement global throttles, batching, and prioritization by tier.
- Cleaner separation: API routes validate and enqueue; workers do heavy lifting.

**Complexity and risks**:
- Medium to high complexity depending on the chosen worker runtime.
- Requires careful credit charging semantics (charge on success vs start, refunds on failure).
- Needs guardrails for concurrency so one user cannot exhaust worker capacity.

---

### Approach B: Keep request-response, add streaming and stronger resilience
**Title**: Streamed Generation with Step-wise Checkpoints

**Problem statement**: Users want immediate feedback and fewer “it hung” moments, but the team may prefer to avoid a full queue system initially.

**Approach**:
- Keep the current API routes, but add **Server-Sent Events (SSE)** for progress updates during generation and uploads.
- Persist **checkpoint state** (e.g. created DB row, uploaded original, uploaded variants) so retries can resume without duplicating work.
- Implement consistent retry-with-backoff and provider error normalization.

**Benefits**:
- Faster to implement than a full queue.
- Better perceived performance and transparency.

**Complexity and risks**:
- Still constrained by serverless timeouts in some deployments.
- Harder to guarantee durability under cold starts and network disconnects.

---

### Approach C: Distributed rate limiting and cost governance
**Title**: Shared Rate Limit Store for Multi-Instance Scaling

**Problem statement**: Current in-memory rate limiting is per instance, which weakens protection as the app scales horizontally. AI routes are expensive and need consistent global enforcement per user.

**Approach**:
- Replace the in-memory limiter store with a shared store such as Redis (Upstash), keeping the same `enforceRateLimit(routeId, request, userId)` API so routes do not change.
- Use a token bucket or sliding window algorithm with TTL keys.
- Extend the limiter to support weighted costs (for example, 4K generation counts more than 1K).

**Benefits**:
- Reliable global throttling across instances.
- Better cost predictability and abuse prevention.

**Complexity and risks**:
- Adds a new infrastructure dependency.
- Requires careful handling of outages so the limiter fails safe for expensive routes.

