# Type: Master Plan & New Feature Brainstorm

**Product:** ViewBait — AI-powered thumbnails for creators  
**Document:** Architect Features (Master Plan + Feature Brainstorm)  
**Date:** 2025-02-05

This document combines the **Master Solutions Architect Plan** (North Star, architecture, integration, roadmap, risks) with the **New Feature Brainstorm** (visionary yet practical features aligned to the current stack and product vision).

---

# Part 1 — Master Plan

## 1. Executive Summary (North Star)

**North Star:** ViewBait is the place where YouTube and video creators **describe what they want and get scroll-stopping thumbnails**—without design skills—while staying in control of their face, style, and platform. The product closes the loop from **create → upload → measure** inside one tool and becomes the default thumbnail workflow for individuals and content teams.

**Strategic pillars:**
- **Speed & ease** — Minimal steps from “this video” to “thumbnail for this video”; no Photoshop.
- **Quality & data** — Thumbnails that look pro and get clicks, with in-app performance feedback.
- **Consistency & control** — Same look across videos (brand kits, batch), their face and style, anchored to YouTube.

**Success looks like:** Creators and teams choose ViewBait as the single place to generate, apply, and learn from thumbnails; retention and upgrade drivers are tied to YouTube integration, performance insights, and team workflows (review, brand kits, batch).

---

## 2. System Architecture

### 2.1 Stack overview

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| **Frontend** | Next.js 16, React 19 | App shell, Studio SPA, landing, auth UI |
| **Routing & auth gate** | `middleware.ts` | Session refresh, protected vs auth routes; does not run for API routes |
| **API** | Next.js Route Handlers (`app/api/**`) | All server-side handlers; auth, validation, Supabase, Stripe, AI |
| **Data & auth** | Supabase (Auth, Postgres, Storage, RLS) | Session, profiles, thumbnails, projects, subscriptions, YouTube tokens, notifications |
| **Payments & entitlements** | Stripe | Checkout, webhooks, tier resolution; credits/tier from DB + product config |
| **AI** | Google Gemini (`ai-core.ts`) | Image generation, assistant chat, function calling; server-only, no prompts in client |
| **External** | YouTube Data / OAuth | Channel list, videos, set thumbnail; tokens in `youtube_integrations` via service role |

### 2.2 Component interaction (high level)

```
[Browser] → middleware (session) → [Studio / Landing / Auth]
     ↓
[Studio UI] → fetch('/api/*') → [Route handlers]
     ↓                              ↓
[React Query / hooks] ← JSON ← requireAuth(supabase) + server data layer
     ↓                              ↓
[Services call APIs]           Supabase (RLS) / Service role (credits, webhooks, YouTube persist)
     ↓                              ↓
[AuthProvider, SubscriptionProvider]   Stripe webhooks, Gemini (ai-core), Storage
```

**Boundaries:**
- **Client:** No secrets; no service role; no raw prompts. Uses anon Supabase + cookie session and calls only public API routes.
- **Server:** `createClient()` (server Supabase), `requireAuth` / `getOptionalAuth`, server data layer, `createServiceClient()` only where RLS must be bypassed (credits RPC, YouTube token persist, broadcast notifications, Stripe).
- **AI:** Prompt construction and Gemini calls only in API routes and `lib/services/ai-core.ts`; errors sanitized before client.

### 2.3 Key subsystems (from system understanding)

- **Server data layer** (`lib/server/data/*`): thumbnails, auth, notifications, subscription tiers, query builders.
- **Query building** (`lib/server/utils/query-builder.ts`): cursor pagination, filters, ordering, `QueryPatterns.userOwnedWithFavorites`, etc.
- **Credits & tier** (`credits.ts`, `tier.ts`, `subscription-tiers`): atomic credit deduction (RPC), tier from `user_subscriptions` + product config, cooldowns.
- **URL refresh** (`url-refresh.ts`): signed storage URLs for thumbnails, faces, styles.
- **Error handling** (`error-handler.ts`, `error-sanitizer.ts`): consistent API errors; no prompt/PII leakage.

---

## 3. Integration Strategy (Synthesizing Perspectives)

| Perspective | How it integrates |
|-------------|--------------------|
| **Strategic** | North Star and pillars (speed, quality, consistency, control) drive which features ship first: one-click “thumbnail for this video” and performance insights deepen the YouTube loop and justify Pro/Advanced. |
| **Security** | Auth at route level (`requireAuth`); RLS for all user data; service role only for credits, webhooks, YouTube token persist; secrets server-only; errors sanitized. New features (brand kits, batch, share-for-review) add tables/APIs with same RLS and no client secrets. |
| **Design / UX** | Brand identity (dark, accent red, creator-studio feel) and voice (“Describe it. We’ll make it.”) apply to all new UI. Feature design reduces friction (one-click from video, one-click brand kit) and keeps control with the creator (review links, batch config). |
| **Technical** | New features reuse: existing API patterns, server data layer, query builder, tier/credits, YouTube services (`channel-videos`, set-thumbnail), share slugs. No new runtime stack; optional new tables (`brand_kits`, thumbnail–video link, review comments) and background jobs only where needed (e.g. batch queue). |
| **Ethical / trust** | “Your face, your style” and clear credit/tier behavior; no dark patterns. Performance data is the user’s own channel data; review comments and sharing stay configurable and transparent. |

---

## 4. Phased Roadmap (MVP → Scale)

### Phase 1 — Foundation (current + quick wins)
- **Stable core:** Auth, tiers, credits, generate, gallery, projects, share (public link), YouTube connect and set-thumbnail.
- **Quick win:** One-click “Thumbnail for this video” from YouTube tab / Pro Assistant (pre-fill title, optional style); no new tier gate.
- **Gate:** Ship when: YouTube video list and generator state can pass `focusedVideoId` / title via navigation or context.

### Phase 2 — Retention & differentiation
- **Thumbnail performance & A/B insights:** Link thumbnails to videos when “Set as thumbnail” is used; pull YouTube Analytics (CTR, views); surface in Studio (Performance view or card badges). Tier: Pro/Advanced.
- **Brand kits:** `brand_kits` table (or extended project/defaults); “Use brand kit” in generator applies style, palette, faces, aspect ratio, resolution, custom instructions. Tier: Starter+.
- **Gate:** Performance depends on YouTube Analytics API and rate limits (caching/refresh strategy). Brand kits depend on CRUD APIs and generator state application.

### Phase 3 — Power users & teams
- **Batch generation:** List of titles (or multi-select from YouTube); one batch config (or brand kit); queue with cooldown/credit checks; optional `batch_id` and gallery filter. Tier: Advanced/Pro.
- **Share-for-review:** Review mode on share links; comment thread (and optional approve/reject) per thumbnail or share slug; creator sees feedback in Studio. Tier: Advanced/Pro.
- **Gate:** Batch needs queue (in-app or background) and clear credit UX. Review needs `share_review_comments` (or similar), RLS, and optional notifications.

### Phase 4 — Scale & optional extensions
- **Multi-seat / orgs:** Build on existing `organizations`, `org_members`, `org_invites` if present; team billing and shared brand kits.
- **Advanced analytics:** Heuristic or ML “suggest variant” from performance history; experiments integration.
- **Gate:** Product and GTM decisions; no blocking technical dependency for core roadmap.

---

## 5. Risk Mitigation

| Risk | Mitigation |
|------|-------------|
| **YouTube API quota / rate limits** | Cache Analytics and video list; daily or on-demand refresh; respect tier/feature gates so only entitled users trigger heavy calls. |
| **Credits and abuse** | Atomic RPC for deduction; idempotency; tier and cooldown enforced in every generate route; batch queue enforces same checks. |
| **Session/cookie sync** | Middleware returns same response that had cookies set by Supabase client; no custom response that drops cookies. |
| **Secrets or prompts in client** | No `NEXT_PUBLIC_*` for secrets; prompts and Gemini only in API/ai-core; all API errors go through sanitizer. |
| **RLS bypass misuse** | Service role only in documented paths (credits, webhooks, YouTube token persist, broadcast); any new use must be justified and documented. |
| **Feature scope creep** | Phased roadmap with clear gates; each feature has tier and effort (see table below); prioritize one-click thumbnail and performance insights. |
| **DB schema drift** | New tables (e.g. `brand_kits`, thumbnail–video link, review comments) via Supabase migrations; types in `lib/types/database.ts` kept in sync. |

---

# Part 2 — New Feature Brainstorm

**Lens:** Human-centric; friction reduction, visual hierarchy, brand alignment (ViewBait brand identity and system understanding).

Below are **five innovative new features** that are both visionary and practically implementable within the current technical stack (Next.js 16, React 19, Supabase, Stripe, Google Gemini). Each is grounded in the existing codebase and product vision (speed, quality, ease, consistency, control).

---

## Overview (summary table)

| # | Feature | Problem | Key benefit | Effort (est.) | Tier / gate | Status |
|---|---------|---------|-------------|---------------|-------------|--------|
| 1 | Thumbnail performance & A/B insights | Creators can’t see which thumbnails actually perform after upload | Data-driven creation; stickiness and upgrade driver | Medium–High | Pro / Advanced | O |
| 2 | One-click “Thumbnail for this video” | Friction between YouTube list and starting a thumbnail | Fewer steps; creation tied to the actual video | Medium | Any (YouTube connect) | O |
| 3 | Brand kits / template presets | Consistency is manual (style/palette/face per session) | One-click consistency for series and teams | Medium | Starter+ | O |
| 4 | Batch generation from video list | One-by-one generation is tedious for courses/series | Power feature for heavy users; clear credit model | Medium–High | Advanced / Pro | O |
| 5 | Share-for-review (comments on shared thumbnails) | Teams need approval/feedback before publishing | Fits agencies and content teams; builds on existing share | Medium | Advanced / Pro | O |

**Status legend:** ✔ Done | ❌ Not doing / rejected | **O** To be / planned

---

## ✔ / O 1. Thumbnail performance & A/B insights

**Status:** O (To be / planned)

### Problem it solves
Creators generate thumbnails in ViewBait and upload them to YouTube but have **no in-app feedback** on which thumbnails actually drive CTR, watch time, or views. The loop “create → upload → see result” happens outside the product.

### How it works
- **Link thumbnails to videos:** When a user sets a thumbnail on a video via the existing YouTube integration, store the association (`thumbnail_id` ↔ `video_id`). Optionally group “test packs” (e.g. 2–4 variants for the same video).
- **Pull performance data:** Use YouTube Analytics APIs (already in stack) to fetch CTR, views, and optionally watch time. Surface in Studio: e.g. “This thumbnail is on Video X — CTR 8.2%, 12K views.”
- **Insights UI:** In the thumbnail card or a dedicated “Performance” view: show which thumbnails are linked to videos, their metrics, and simple comparisons. Optional: “Suggest which variant to use” based on past performance.

### Core benefits
- **Users:** Data-driven decisions; see impact of ViewBait thumbnails without leaving the app.
- **Business:** 🔴 Strong differentiator; justifies Pro/Advanced and increases retention (closed loop).

### Technical considerations
- **Data model:** Persist `thumbnail_id` ↔ `video_id` when “Set as thumbnail” is used; optional `experiments` or `batch_id` for A/B sets.
- **YouTube Analytics:** Already integrated; rate limits and caching (e.g. daily refresh).
- **UI:** New “Performance” filter or section in gallery; optional badges on cards for “On YouTube” + CTR/views.
- **Tier:** Pro or Advanced.

### Alignment with product vision
- **Quality:** “Thumbnails that look pro and get clicks” is directly supported by showing clicks and performance.
- **Control:** Creators keep control while getting data to improve.

---

## ✔ / O 2. One-click “Thumbnail for this video”

**Status:** O (To be / planned)

### Problem it solves
High friction between “I’m looking at my video list” and “I need to make a thumbnail.” Users must remember the title, switch to the generator, and re-enter context.

### How it works
- **Entry points:** From the YouTube tab (video card or list) and/or from the Pro Assistant: a clear CTA **“Create thumbnail for this video.”**
- **Pre-fill:** Open the Generator with title/prompt pre-filled from the video title (and optionally from video summary/analysis when that pipeline exists). Optional: pre-fill style from current video thumbnail.
- **Context passed through:** In-app state (`focusedVideoId` / `focusedVideoTitle`) or deep link to Studio with query params that set initial generator state.

### Core benefits
- **Users:** One click from “this video” to “thumbnail for this video”; fewer steps and less cognitive load.
- **Business:** 💡 Increases generation frequency and strengthens the YouTube ↔ ViewBait loop.

### Technical considerations
- **APIs:** Reuse `channel-videos`, video details, and (when built) video analysis/summary. Add a “create thumbnail for video” action that returns or navigates with state.
- **State:** Use existing `focusedVideoId` / `focusedVideoTitle` and generator form state; StudioProvider or navigation accepts initial values (e.g. from search params or context).
- **Tier:** Any; best when YouTube is connected.

### Alignment with product vision
- **Speed & ease:** “Describe it, get it” is served by reducing steps from video to thumbnail.
- **Platform cue:** YouTube as anchor is reinforced by making the video the starting point.

---

## ✔ / O 3. Brand kits / template presets

**Status:** O (To be / planned)

### Problem it solves
Users want **consistency** across thumbnails (same look for a series or channel), but today that means manually re-selecting the same style, palette, face(s), and settings every time.

### How it works
- **Brand kit entity:** A named preset (e.g. “Gaming channel”, “Tutorial series”) that stores: default style, palette, default face(s), optional aspect ratio and resolution, and optional custom instructions. Stored per user (`brand_kits` table or extended projects/settings).
- **Apply in generator:** A dropdown or selector: “Use brand kit: [Name]”. One click applies all saved settings to the current form.
- **Optional:** “Lock” for teams so a project or workspace always uses a given brand kit by default.

### Core benefits
- **Users:** One-click consistency; ideal for series creators and content teams.
- **Business:** 🟡 Increases perceived value of Starter+ and supports team/agency positioning.

### Technical considerations
- **Data model:** New table `brand_kits` (user_id, name, settings JSONB) or reuse/expand project `default_settings` with a “brand kit” type. Settings shape can mirror `ProjectDefaultSettings`.
- **APIs:** CRUD for brand kits; generator reads list and applies selected kit to StudioProvider state.
- **Tier:** Starter+ (same as custom styles/palettes/faces).

### Alignment with product vision
- **Consistency:** “Same ‘look’ across videos” is explicitly supported.
- **Control:** “Their face, their style, their platform” centralized in a reusable kit.

---

## ✔ / O 4. Batch generation from video list

**Status:** O (To be / planned)

### Problem it solves
Creators with **many videos** (course, series, backlog) need many thumbnails with a consistent look. One-by-one generation is tedious and breaks flow.

### How it works
- **Input:** User provides a list of titles (or selects multiple videos from the YouTube tab). Option: upload CSV or paste lines.
- **Settings:** One “batch config”: one style, palette, default face(s), aspect ratio, resolution (from generator or brand kit). Same settings apply to every item.
- **Execution:** For each row/video: call existing `POST /api/generate` with that title and batch settings. Use a **queue** (in-app with progress UI, or background job) to respect rate limits and tier cooldowns. Deduct credits per generation.
- **Output:** New thumbnails in gallery, optionally tagged with `batch_id` or project; filter “Batch: Course 101.” Optional: “Apply to video” for each (existing set-thumbnail flow).

### Core benefits
- **Users:** Produce a full set of on-brand thumbnails without repeating the form many times.
- **Business:** 🟡 Power feature for Advanced/Pro; clear credit consumption and differentiator for educators and series creators.

### Technical considerations
- **Queue and rate limits:** In-app queue that respects `getGenerateCooldownMs(tier)` and credit checks; show “3/10 generated” and allow pause/cancel. Alternative: server-side job queue for large batches.
- **Credits:** Each generation costs as today (resolution × variations); upfront check “You need N credits” before starting.
- **Data:** Optional `batch_id` on thumbnails and “batch” filter in gallery.
- **Tier:** Advanced or Pro.

### Alignment with product vision
- **Speed:** “I don’t have time to configure 20 thumbnails one by one.”
- **Consistency:** Batch config enforces one look across many titles.

---

## ✔ / O 5. Share-for-review (comments on shared thumbnails)

**Status:** O (To be / planned)

### Problem it solves
**Teams and agencies** need to approve or comment on thumbnails before publishing. Today, sharing gives a view and maybe click tracking, but no way for reviewers to leave feedback or approve/reject in context.

### How it works
- **Review mode for shared links:** When creating a share link, creator can mark it as “Review.” Reviewers open the same public share page and see a **comment thread** on the thumbnail (or on the project if multiple thumbnails).
- **Comments:** Timestamped comments (and optionally approval/reject) stored per thumbnail or per share slug; reviewers can be link-only or required to sign in (configurable). Creator sees feedback in Studio (e.g. notification + “Review feedback” on the card).
- **Notifications:** Reuse in-app notifications when someone comments or approves; optional email digest.

### Core benefits
- **Users:** Approval and feedback in one place; no swapping screenshots in Slack or email.
- **Business:** 🟢 Aligns with “content marketing teams” and “social media managers”; justifies Advanced/Pro and multi-seat later.

### Technical considerations
- **Data model:** `share_review_comments` (or similar): share_slug or thumbnail_id, author, content, approved/rejected flag, created_at. RLS: only share owner can read; anyone with link can write if share allows review.
- **APIs:** GET/POST comments for a share slug or thumbnail; optional PATCH to mark “review complete.”
- **UI:** On shared page, comment list and input when review enabled; in Studio, badge or panel “X comments” and link to view.
- **Tier:** Advanced or Pro.

### Alignment with product vision
- **Target market:** “Content marketing teams” and “Social media managers” are directly served.
- **Control:** Creator stays in control of who has the link and whether review is enabled.

---

## Summary (themes)

| Theme | Features |
|-------|----------|
| 🔴 High priority / differentiator | 1 (Performance & A/B), 2 (One-click thumbnail for video) |
| 🟡 Consistency & scale | 3 (Brand kits), 4 (Batch generation) |
| 🟢 Teams & collaboration | 5 (Share-for-review) |

All five features use the **existing stack** (Supabase, Stripe tiers, Gemini, YouTube APIs, existing share and generator flows). They reduce friction, support consistency and control, and either deepen the YouTube integration or expand into teams and power users—keeping ViewBait aligned with its brand and technical foundations.

---

*End of Master Plan & New Feature Brainstorm.*
