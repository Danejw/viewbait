# Type: New Feature Brainstorm

**Version:** 2026-02-14T06:12:59Z  
**Product:** ViewBait.app

These ideas are designed to be visionary but buildable with the current stack: Next.js App Router (`app/`), Supabase (Auth, Postgres with RLS, Storage, RPC), Stripe, and Gemini (image + tool calling). Each idea calls out the main implementation surfaces (UI, API routes, server data layer, Supabase schema).

---

## 1) YouTube Thumbnail A-B Rotator Experiments

### Problem
Creators want A-B testing, but running experiments (and tracking results) is awkward and time-consuming. ViewBait already stores thumbnails, has experiments tables, and has YouTube integration endpoints, but the workflow is not a cohesive "launch experiment" experience.

### Proposed solution (how it works)
Let a creator select 2 to 4 existing thumbnails and a YouTube video, then run a scheduled rotation that swaps the video thumbnail at defined intervals and records performance deltas per variant.

- **User flow (Studio)**:
  - Select thumbnails in Gallery.
  - Click "Run experiment" and choose a target YouTube video.
  - Choose rotation schedule (for example: 6-hour blocks over 3 days).
  - View experiment dashboard with per-variant metrics and a recommended winner.

- **Execution path (high level)**:
  - UI in `components/studio/**` orchestrates selections and status.
  - Server creates an experiment row (Supabase `experiments` table already exists per `supabase/tables/SCHEMA_SUMMARY.md`).
  - A server scheduler (cron route) rotates thumbnails via `app/api/youtube/videos/[id]/set-thumbnail/route.ts`.
  - Analytics snapshots are collected via existing YouTube analytics routes under `app/api/youtube/videos/**`.

### Core benefits
- Users can run real experiments without external tooling.
- Pro-tier retention and upsell: "experiments" is a premium workflow.
- Differentiation: connecting generation directly to measured outcomes.

### Technical considerations and challenges
- Scheduling: use a protected cron endpoint (pattern: `app/api/cron/cleanup-free-tier-thumbnails/route.ts` + `CRON_SECRET`) to run rotation jobs.
- YouTube auth: ensure token refresh and scope checks remain correct (see `app/auth/callback/route.ts` token persistence and YouTube refresh routes).
- Idempotency and auditability: write append-only logs for swaps, and avoid duplicate rotations.
- Rate limits: YouTube APIs require careful backoff and caching.

### Vision alignment
Matches "Phase 2: A-B testing integration with YouTube analytics" in `agentics/VISION.md` while leveraging existing YouTube and experiments capabilities.

---

## 2) Brand Kit and Guardrailed Prompting

### Problem
Creators struggle to keep visual consistency across videos, especially across collaborators or multiple channels. Saved styles help, but there is no single "brand contract" that the generator and assistant reliably enforce.

### Proposed solution (how it works)
Introduce a "Brand Kit" that defines consistent constraints and defaults (tone, colors, compositional rules, text rules). The assistant and generation routes automatically incorporate the brand kit when creating prompts.

- **User flow (Studio)**:
  - Create a Brand Kit: channel name, target audience, text style rules, banned words, preferred palettes, default aspect ratio and resolution.
  - Optionally attach 3 to 10 "gold standard" thumbnails as references.
  - Toggle brand kit per project or per generation.

- **Execution path (high level)**:
  - Store brand kit in a user-owned table (or `settings`) with RLS.
  - UI: add a panel in `components/studio/**` and wire into Studio state in `components/studio/studio-provider.tsx`.
  - API: generation (`app/api/generate/route.ts`) and assistant (`app/api/assistant/chat/route.ts`) append a server-side "brand kit block" to prompt construction.

### Core benefits
- More consistent outputs with fewer iterations.
- Better onboarding: a "set it once" workflow for returning users.
- Increases style reuse and user stickiness.

### Technical considerations and challenges
- Avoid leaking the kit: keep the "brand kit block" server-side only (same rule as generation prompts).
- Multi-tenant readiness: can later be org-scoped using `organizations` and `org_members` tables listed in `supabase/tables/SCHEMA_SUMMARY.md`.
- Prompt injection safety: sanitize user-entered brand kit text and prevent it from overriding system constraints.

### Vision alignment
Directly supports "Consistency is hard" and "Style memory" from `agentics/VISION.md` and the product brief.

---

## 3) One-Click Generate From YouTube Video Context

### Problem
Creators often start from a YouTube video URL. Manually translating a video into a strong thumbnail concept is hard, and the current workflow requires many steps.

### Proposed solution (how it works)
Given a YouTube video link or ID, ViewBait can analyze the video context (topic, key moments, emotions, objects) and propose 3 to 5 thumbnail concepts, then generate the best 1 to 4 options with one click.

- **User flow (Studio)**:
  - Paste YouTube URL into the assistant or a new "From YouTube" panel.
  - Choose one suggested concept (or edit it).
  - Click Generate. The system pre-fills style references and instructions automatically.

- **Execution path (high level)**:
  - Use existing analysis endpoints like `app/api/youtube/videos/analyze/route.ts` and chat tool outputs in `app/api/assistant/chat/route.ts` (see `youtube_analyze_video` branch).
  - In Studio, reuse existing modal and cache patterns in `components/studio/studio-provider.tsx` (video analytics caching and "open generator for video" helpers).
  - Generation still flows through `POST /api/generate` to keep secrets server-side.

### Core benefits
- Faster time-to-first-thumbnail for new users.
- Strong differentiation: AI assistant that understands the video, not just the title.
- Higher conversion to Pro by showcasing YouTube capabilities.

### Technical considerations and challenges
- Tier gating: enforce Pro tier on the server for YouTube analysis and video-specific features.
- YouTube API quotas and latency: cache video analysis results by video ID.
- UX: allow partial success and clear error messages when a video is private/unavailable.

### Vision alignment
Matches "Phase 3: Automatic thumbnail generation from video content" in `agentics/VISION.md` using existing analysis hooks and routes.

---

## 4) Shared Projects and Team Workspaces

### Problem
Creators work with editors and teams. Today, sharing and collaborating on thumbnail sets, styles, and experiment results is fragmented.

### Proposed solution (how it works)
Enable team workspaces with shared Projects. Members can collaborate on project settings, comments, and thumbnail selection, with owner and editor roles.

- **User flow (Studio)**:
  - Create an Organization workspace.
  - Invite editors.
  - Create shared Projects under the org.
  - Editors can comment, propose variants, and run experiments under controlled permissions.

- **Execution path (high level)**:
  - Supabase already includes `organizations`, `org_members`, and `org_invites` tables (see `supabase/tables/SCHEMA_SUMMARY.md`).
  - Add `org_id` or membership checks to project-owned resources with RLS helper functions as described in `docs/database_security_principles.md`.
  - Add API routes for invites and membership actions using RPC for sensitive writes.

### Core benefits
- Expands target audience to teams and agencies.
- Increases retention and ARPA (team plans).
- Makes ViewBait a workflow tool, not just a generator.

### Technical considerations and challenges
- Multi-tenant security: strict membership checks in RLS and RPC.
- Migration strategy from per-user projects to org-scoped projects.
- UI complexity: permission-aware UX (editor vs owner).

### Vision alignment
Matches "Phase 4: Team collaboration and brand guidelines enforcement" in `agentics/VISION.md`.

---

## 5) Thumbnail Quality Checks and Fix Suggestions

### Problem
Even strong generations can fail common thumbnail rules: unreadable text at small sizes, low contrast, cluttered composition, poor face prominence. Users currently discover these issues by trial and error.

### Proposed solution (how it works)
Add an on-demand "Quality Check" action that analyzes a thumbnail image and returns a short, structured critique plus recommended edits. Optionally, generate an "auto-fix" variant that applies the recommendations.

- **User flow (Studio)**:
  - Click "Quality check" on any thumbnail card.
  - See a score breakdown (readability, contrast, focal point, face clarity).
  - Click "Auto-fix" to run an edit prompt via `/api/edit`.

- **Execution path (high level)**:
  - Server route `POST /api/thumbnails/quality-check` calls Gemini vision via `lib/services/ai-core.ts`.
  - Uses existing storage URL handling patterns (signed URLs in `lib/server/utils/url-refresh.ts`).
  - "Auto-fix" uses `POST /api/edit` and existing credit enforcement patterns.

### Core benefits
- Better outcomes without extra design skill.
- More successful thumbnails means happier users and more referrals.
- Natural upsell for higher tiers (batch fixes, advanced scoring, heatmap bundle).

### Technical considerations and challenges
- Ensure analysis outputs are sanitized and do not leak internal prompts.
- Tie into credit and tier logic (pattern: `app/api/generate/route.ts` credit deduction).
- Avoid overloading Gemini: add caching for repeat checks on the same thumbnail ID.

### Vision alignment
Supports the product principle "Speed over perfection" by accelerating iteration and reducing dead-end generations.

---

*End of brainstorm.*

