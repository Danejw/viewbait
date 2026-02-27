Type: New Feature Brainstorm

# ViewBait.app — New Feature Brainstorm (Visionary + Implementable)

This brainstorm is grounded in the current codebase and documented product direction:

- **Product vision**: conversation-first thumbnail creation, fast iteration, style memory, face library, batch generation, mobile parity (`agentics/VISION.md`).
- **Current platform capabilities**:
  - Next.js App Router with a deep server surface in `app/api/**/route.ts`
  - Supabase Auth + Postgres + Storage (`lib/supabase/{server,client,service}.ts`)
  - Gemini integrations for image, text, and structured outputs (`lib/services/ai-core.ts`)
  - Tier/credits enforcement server-side (`app/api/generate/route.ts`, `lib/server/utils/tier.ts`, `lib/server/utils/credits.ts`)
  - YouTube OAuth + actions + analytics endpoints (`app/api/youtube/**`)
  - Experiments and analytics subsystems already present (`app/api/experiments/**`, `app/api/admin/analytics/**`, `docs/analytics_events_implementation.md`)
  - Collaboration primitives: projects, share links, and comments (`app/api/projects/**`, `app/api/thumbnails/[id]/comments/route.ts`, `supabase/migrations/014_thumbnails_comments.sql`)

Below are **5** features that are “visionary but buildable” without changing the stack.

---

## 1) YouTube Thumbnail A/B Experiment Runner (Auto-rotate + Analytics)

### What problem it solves and how it works
Creators want to A/B test thumbnails, but doing it manually is annoying and inconsistent. ViewBait already supports generating variations and has a YouTube integration surface, but it doesn’t yet provide an opinionated “run the test, collect results, declare a winner” workflow.

**How it works (proposed flow):**
- In Studio, user selects **2–4 generated thumbnails** and chooses a YouTube video.
- They start an “experiment” with a schedule (for example: rotate every 6 hours for 3 days).
- The system:
  - Pushes each thumbnail to YouTube on schedule via existing endpoints like `POST /api/youtube/videos/[id]/set-thumbnail` (`app/api/youtube/videos/[id]/set-thumbnail/route.ts`).
  - Pulls analytics periodically via existing YouTube analytics routes (`app/api/youtube/videos/[id]/analytics/route.ts` and/or `app/api/youtube/analytics/route.ts`).
  - Stores observations per variant (impressions, CTR, watch time proxies), then surfaces a winner with statistical guidance.

### Core benefits
- **User value**: automated testing; less manual work; confidence in decisions; higher CTR.
- **Business value**: a sticky Pro-tier differentiator (aligns with “Phase 2: A/B testing integration with YouTube analytics” in `agentics/VISION.md`), drives upgrades and retention.

### Technical considerations / challenges
- **Scheduling**: implement with Vercel Cron hitting new routes (pattern already exists: `app/api/cron/cleanup-free-tier-thumbnails/route.ts`). Proposed:
  - `app/api/cron/experiments/run/route.ts` to rotate thumbnails and ingest analytics.
- **Token management**: YouTube tokens are stored in `youtube_integrations` via the service-role client (`lib/supabase/service.ts`). Rotation/analytics jobs must handle expiry and refresh (existing refresh surface: `app/api/youtube/refresh/route.ts`).
- **Data model**: experiments tables already exist (`supabase/tables/experiments.json`, routes in `app/api/experiments/**`). Likely extend with:
  - `experiment_variants` rows referencing `thumbnails.id`
  - `experiment_observations` time-series rows
  - winner fields + experiment lifecycle state machine (draft → running → completed).
- **Authorization**: cron endpoints must be protected with a secret header/token; do not expose cross-user operations. Use the service role only for the cron job, but ensure every experiment row is owned by a user/org (RLS + server validation).
- **UI**: implement an “Experiments” Studio view using existing experiments routes/services (`lib/services/experiments.ts`, `lib/hooks/useExperiments.ts`).

### Alignment with product vision
Directly supports “speed over perfection” and “iteration is slow” pain point by making iteration measurable and repeatable, while extending “batch generation” into “batch testing.”

---

## 2) Auto-Generate Thumbnail Concepts From a YouTube Video (Scene → Hooks → Variations)

### What problem it solves and how it works
Creators often don’t know what to put on the thumbnail. They need concept ideation tied to the actual content (key moment, emotional hook, conflict).

**How it works (proposed flow):**
- User pastes a YouTube URL (or selects from “My Channel” list).
- Server analyzes the video using Gemini video understanding utilities already present in `lib/services/ai-core.ts` (see functions like `callGeminiWithYouTubeVideoAndStructuredOutput(...)`).
- The system returns:
  - 5–10 “thumbnail concepts” (shot description, text hook, emotional expression/pose suggestions, style/palette hints)
  - 3–5 title variations (or integrates with existing title enhancement)
- User clicks a concept and it **pre-fills** the Studio generator form (text, expression, pose, aspect ratio/resolution, custom instructions), then generates 2–4 variations.

### Core benefits
- **User value**: removes ideation block; improves first-attempt quality; makes the assistant feel like the “interface.”
- **Business value**: increases successful generations per session and improves activation; pairs naturally with Pro-tier YouTube integration.

### Technical considerations / challenges
- **Use existing endpoints**: there is already a suggest endpoint: `app/api/youtube/videos/suggest-thumbnail-concepts/route.ts`. Extend it to:
  - return a structured schema that maps directly onto Studio form state keys
  - optionally include a “ready to generate” flag.
- **Assistant integration**: add a new assistant tool (similar to `youtube_analyze_video` in `app/api/assistant/chat/route.ts`) to “suggest concepts” and return `form_state_updates` + a small list of concepts for UI rendering.
- **Tier gating**: enforce Pro on YouTube-derived features consistently using `getTierNameForUser(...)` (`lib/server/utils/tier.ts`) as already done in `app/api/youtube/connect/authorize/route.ts` and in assistant chat logic.
- **Cost control**: rate limit this endpoint using `enforceRateLimit(...)` (`lib/server/utils/rate-limit.ts`) and cap analysis depth.

### Alignment with product vision
Pushes “conversation first” toward “content-aware conversation,” and sets up “Phase 3: automatic thumbnail generation from video content” in `agentics/VISION.md`.

---

## 3) Brand Kit + Style Guardrails (Consistency Through Constraint, Enforced)

### What problem it solves and how it works
Users want brand consistency (fonts, colors, tone, “no clickbait words,” safe-area rules). Today, consistency is implicit via saved styles/palettes, but there’s no **explicit brand policy** that the generator and assistant must follow.

**How it works (proposed flow):**
- User creates a “Brand Kit”:
  - preferred palette(s), text style guidance, do/don’t rules, safe-area margins, optional “channel niche”
  - optional “default faces” and “default style”
- When generating:
  - `app/api/generate/route.ts` injects brand kit constraints into `promptData` (as structured JSON, not unstructured text).
  - The assistant also sees the brand kit and suggests settings consistent with it.
- After generation:
  - a lightweight “compliance check” runs (text readability, contrast, safe-area placement heuristics) and suggests edits if needed.

### Core benefits
- **User value**: consistent thumbnails without needing design discipline; fewer “random-looking” outputs.
- **Business value**: improved retention (creators return when outputs match their brand); potential higher-tier feature (“brand kits” for teams/Pro).

### Technical considerations / challenges
- **Data storage**: re-use `settings` table (`supabase/tables/settings.json`) or add a new table `brand_kits` with `user_id` ownership and RLS.
- **UI**: add a Studio settings section (right sidebar) storing/updating brand kit via a new API route (pattern: `app/api/profiles/route.ts` + `lib/services/profiles.ts`).
- **Prompt safety**: treat brand rules as user input; sanitize and never log raw content. Keep prompts server-side; errors sanitized via `lib/utils/error-sanitizer.ts`.
- **Enforcement**: do not rely on client-only checks; if you tier-gate this, enforce via API (like heatmap gating in `POST /api/thumbnails/heatmap`).

### Alignment with product vision
Directly embodies “Consistency Through Constraint” and makes the assistant feel like a collaborator who “remembers your brand.”

---

## 4) Project Review Mode: Shareable Approval Links + Annotated Comments + Notifications

### What problem it solves and how it works
Creators often get feedback from editors, managers, or sponsors. Today there are share links and comments primitives, but no cohesive “review workflow” (approval states, pinned notes, notifications).

**How it works (proposed flow):**
- A project owner generates a share link (existing surface: `app/api/projects/share/[slug]/route.ts`).
- Reviewers can:
  - comment on specific thumbnails (`app/api/thumbnails/[id]/comments/route.ts`)
  - add **pinned comments** with coordinates (x/y) on the thumbnail
  - mark a thumbnail “Approved,” “Needs changes,” or “Final.”
- The owner gets in-app notifications (existing notifications surface: `app/api/notifications/**`, `docs/in-app-notifications-documentation.md`).

### Core benefits
- **User value**: makes ViewBait viable for professional workflows; reduces back-and-forth in DMs.
- **Business value**: expands market to teams and agencies; aligns with “Phase 4: team collaboration and brand guidelines enforcement.”

### Technical considerations / challenges
- **Data model**: comments already exist (migration `supabase/migrations/014_thumbnails_comments.sql`). Extend with:
  - optional `x`, `y` fields for pins
  - `status` field or a separate `thumbnail_reviews` table.
- **Access control**:
  - share links must not become an IDOR vector; routes like `app/api/projects/share/[slug]/me/route.ts` show patterns to follow.
  - reviewers should have scoped access; consider using `project_editors` patterns (see `supabase/migrations/010_project_editors_and_editor_slug.sql`) and “viewer” access via share slug.
- **Notifications**: use server-side insert into `notifications` via existing patterns, and ensure rate limit for comment spam (`lib/server/utils/rate-limit.ts`).

### Alignment with product vision
Preserves “left-to-right flow” while enabling more serious usage. Also increases engagement via collaboration loops.

---

## 5) “Winning Thumbnail” Insights: Performance Scoring + Auto-Highlights + Next-Step Suggestions

### What problem it solves and how it works
Users generate lots of thumbnails but don’t know which are “best.” The app has analytics, favorites, share-click tracking, and YouTube metrics surfaces, but no unified “what’s working” loop.

**How it works (proposed flow):**
- Compute a per-thumbnail “performance score” and surface:
  - “Top picks this week”
  - “Best performing for Project X”
  - “Underrated” (high saves/favorites but low usage)
- Sources (already in stack):
  - internal signals: favorites (`app/api/favorites/**`), share clicks (`app/api/projects/share/[slug]/click/route.ts`), downloads (analytics event `thumbnail_download`)
  - YouTube signals (Pro): impressions/CTR deltas from existing analytics endpoints
- The assistant uses this to suggest next actions:
  - “Generate 2 variations closer to thumbnail #123’s style”
  - “Try the same hook text with a different palette”

### Core benefits
- **User value**: turns generation into an improvement loop; helps creators learn what works for their audience.
- **Business value**: increases retention and Pro conversion (YouTube metrics enrich scoring).

### Technical considerations / challenges
- **Aggregation**: build server-side aggregation endpoints (example style: `app/api/admin/analytics/events/route.ts`) that return summary stats per thumbnail.
- **Data hygiene**: keep score explainable (show top contributing factors).
- **Privacy**: do not expose per-user analytics in public share pages; enforce auth (or use share-scope rules).

### Alignment with product vision
Supports “AI guidance” and “iterate faster,” while leveraging the existing analytics/events system to drive meaningful user outcomes.

---

## Notes on feasibility and rollout

- **Fastest to ship (2–4 weeks)**: #3 Brand Kit Guardrails, #4 Review Mode enhancements, #5 Insights (internal signals first).
- **Medium (4–8 weeks)**: #2 Video → Concepts (depending on analysis cost/UX polish).
- **Most strategic (6–10 weeks)**: #1 A/B Experiment Runner (requires scheduling, robust token refresh, and clean experiment lifecycle).

