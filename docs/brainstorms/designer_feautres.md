# Type: New Feature Brainstorm

**Product:** ViewBait — AI-powered thumbnails for creators  
**Lens:** Senior Product Designer — human-centric, friction reduction, visual hierarchy, emotional resonance, brand alignment  
**Date:** 2025-02-05  
**Context:** Feature ideas that prioritize user friction reduction, intuitive workflows, visual consistency, and emotional connection with the product, while remaining feasible within the current stack (Next.js, Supabase, Stripe, Gemini) and product vision.

---

## Overview

The table below summarizes designer-led feature proposals. Each aims to improve **how** users feel and move through the product—reducing anxiety, increasing confidence, and making the path from idea to thumbnail feel natural and on-brand.

| # | Feature | Problem | Key benefit | Effort (est.) | Tier / gate | Status |
|---|---------|---------|-------------|---------------|-------------|--------|
| 1 | Inspiration feed / thumbnail mood board | Blank-canvas anxiety; no clear starting point | ✅ Lower friction to first idea; emotional pull | Medium | Free+ (curated); Pro (personal) | O |
| 2 | Style personality quiz (“Find your look”) | Style picker overload; impersonal choice | ✅ On-brand “we get you” moment; faster style choice | Small–Medium | All | O |
| 3 | One-tap “Remix my best” | Creators don’t know what actually performs | Data-driven start + confidence | Medium–High | Advanced / Pro (YouTube) | O |
| 4 | Share-for-feedback (collaborative review) | “Is this good?” anxiety before publishing | ✅ Social validation; shareability loop | Medium | All | O |
| 5 | Thumbnail “health” score + nudges | No objective signal that a thumbnail is “good” | ✅ Confidence + learning; complements heatmap | Medium | Starter+ (score); heatmap stays Pro | O |

**Status legend:** ✔ Done | ❌ Not doing | **O** To be / planned

---

## O 1. Inspiration feed / thumbnail mood board

**Status:** O — To be / planned

### Problem it solves

🔴 Many creators open the app with a vague idea or no idea at all. A blank prompt and a grid of styles can feel overwhelming. There’s no “browse first” path that reduces anxiety and sparks direction before they type a single word.

### How it works

- **Curated feed (Free+):** A dedicated view (e.g. “Inspiration” in sidebar or onboarding) showing a scrollable grid of **curated** thumbnails—by category (gaming, tutorial, vlog, etc.) or mood (bold, minimal, face-forward). No generation yet; pure browse. Tapping a card could “Use as inspiration” and pre-fill prompt/style hints.
- **Personal “my best” feed (Pro):** For users with YouTube connected, a section that surfaces their own top-performing thumbnails (by CTR or views). Same “Use as inspiration” action to remix.
- **Visual hierarchy:** Dark, card-based layout consistent with `brand_identity.md`; one primary action per card (“Use this”), secondary “Save to mood board” if we add saved collections later.

### Core benefits

- **Users:** ✅ Lower friction to first idea; emotional resonance (inspiration before effort). Clear mental model: “Look → Like → Create.”
- **Business:** Better activation (users who open Inspiration before Generate may have higher completion); differentiator vs “empty box” tools.

### Technical considerations

- **Data:** Curated set = static or CMS-backed list of thumbnail URLs + metadata (category, style tags). Personal “best” = YouTube analytics + our experiments/thumbnails linkage (Phase 2).
- **UX:** Ensure Inspiration doesn’t replace the conversation-first entry; it can sit as “Not sure where to start? Browse inspiration” from assistant or landing in Studio.
- **Rights:** Curated images must be licensed or generated; no UGC in curated feed without clear rights.

### Alignment with product vision

💡 Fits “creator-centric value” and “speed to first thumbnail.” Complements conversation-first: assistant can say “Want to browse some ideas first?” and link to Inspiration. Brand: dark, focused, no clutter—aligned with `brand_identity.md`.

---

## O 2. Style personality quiz (“Find your look”)

**Status:** O — To be / planned

### Problem it solves

🟡 Choosing a style from a large grid is impersonal and can feel arbitrary. New users (and even returning users exploring new looks) may not have the vocabulary to pick “what fits me.” This creates decision fatigue and slows the path to first thumbnail.

### How it works

- **Short quiz (3–5 questions):** Questions about content type (gaming, education, vlog…), tone (professional, playful, bold…), and maybe one visual preference (busy vs minimal, face vs no face). No long forms—single choice or chips per step.
- **Output:** “We recommend these styles for you” — 2–4 styles highlighted with a short line each (“Great for tutorials and how-tos”). User can pick one and proceed to generate, or ignore and browse all styles.
- **Placement:** Optional step in onboarding (after “Pick a style” or instead of raw grid); or a “Find your look” entry point in Studio style picker for returning users.
- **Visual design:** Stepper, progress indicator, and result cards use existing design tokens (surface, border, accent). Copy in brand voice: friendly, capable, a bit of wit.

### Core benefits

- **Users:** ✅ Emotional resonance—“ViewBait gets me.” Faster, more confident style choice; reduces overwhelm.
- **Business:** Strong onboarding differentiator; can measure “quiz completions” and “generated with recommended style” as engagement signals.

### Technical considerations

- **Logic:** Mapping quiz answers → style IDs can be rule-based (content type + tone → tags) or later enhanced with a small ML model. Start with a simple matrix in code or config.
- **Styles:** Use existing public/default styles; quiz only filters and ranks, no new style entities.
- **Mobile:** Same flow; one question per screen or compact single screen with sections.

### Alignment with product vision

💡 “No design skills” and “describe what you want” are supported by making the first big choice (style) feel guided and personal. Fits onboarding proposal and brand voice (expert friend who gets thumbnails).

---

## O 3. One-tap “Remix my best”

**Status:** O — To be / planned

### Problem it solves

🔴 Creators with a library of published thumbnails rarely know which one actually performed best. Even when they do, starting “from that thumbnail” today means manually describing it or re-uploading. Friction is high; opportunity for data-driven iteration is underused.

### How it works

- **Entry:** In YouTube tab or gallery, for a video that has a current thumbnail and (where available) CTR/performance data, show a primary action: “Remix my best.” One tap.
- **Behavior:** System uses the **current thumbnail image** (and optionally title) as the creative brief: extract style, composition, text placement, face usage → pre-fill generator (style hints, prompt seed, aspect ratio) so the user gets a “variant” in one click, then can refine.
- **Clarity:** Copy like “Start from this thumbnail’s style and layout” so the user understands they’re iterating, not replacing blindly.

### Core benefits

- **Users:** ✅ Data-driven start (best performer as seed); confidence that they’re building on what works.
- **Business:** Stickiness for Advanced/Pro; natural tie-in to A/B and video analysis (Phase 2). Differentiator vs tools that ignore performance.

### Technical considerations

- **Data:** Needs YouTube thumbnail URL + optional analytics (CTR). Video analysis (summary + attributes) can inform “best” (e.g. top CTR in channel). Experiments API and thumbnails table already link to videos.
- **AI:** “Extract style/layout from this image” = vision pass (Gemini) to produce structured hints for generator; same server-only pattern as heatmap and style analysis.
- **Tier:** Gate on Advanced/Pro and YouTube connected; clear upgrade path if user isn’t eligible.
- **⚠️ Cost:** Vision + generate in one flow; watch token/cost and consider caching “remix hints” per thumbnail.

### Alignment with product vision

💡 Directly supports “data-driven decisions” and “which thumbnail performs better” from Master Plan Phase 2. Creator-centric: their best work becomes the starting point.

---

## O 4. Share-for-feedback (collaborative review)

**Status:** O — To be / planned

### Problem it solves

🟡 Creators often want a second opinion before publishing. “Is this good?” anxiety is real. Today we have share links (`/p/[slug]`, `/e/[slug]`) but no structured way to **collect feedback**—so sharing doesn’t close the loop or create a habit.

### How it works

- **Share flow:** When sharing a thumbnail (or pack), user can choose “Share for feedback.” Recipients get a link that opens the thumbnail plus a minimal feedback UI: e.g. 1–5 stars or quick reactions (👍 👎 🔥) and an optional short comment.
- **Creator view:** “Feedback” section or tab showing recent shares and aggregate reaction + comments. No complex threading—just “3 people responded; 2 🔥, 1 👍” and the comments list.
- **Privacy & safety:** Only people with the link can respond; optional “approve comments before showing.” No public gallery; stays within share-link model.
- **Visual design:** Feedback UI is minimal (dark, one CTA per card). Comments use same typography and surface as the rest of the app; no heavy modals.

### Core benefits

- **Users:** ✅ Social validation; reduced “is this good?” anxiety. Natural shareability loop (share → feedback → iterate).
- **Business:** More shares = more touchpoints and potential signups; feedback data could inform “thumbnail health” or recommendations later.

### Technical considerations

- **Data:** New table or extension for “share_feedback”: share_slug, respondent_id (optional), rating/reaction, comment, created_at. RLS: creator can read feedback for their shares; anyone with link can write (or use anonymous token).
- **Spam/abuse:** Rate limit feedback per link; optional captcha or auth for comment. Keep MVP simple: link secret = enough for v1.
- **Notifications:** Optional in-app or email to creator when someone leaves feedback (leverage existing notifications).

### Alignment with product vision

💡 Fits “creator-centric” and “control”—creators stay in charge of what to publish. Share links already exist; this adds a clear **purpose** to sharing (get feedback), improving UX and engagement. Brand: confident but approachable; “get a second opinion” fits the expert-friend tone.

---

## O 5. Thumbnail “health” score + gentle nudges

**Status:** O — To be / planned

### Problem it solves

🟡 Beyond gut feel, creators have no simple signal that a thumbnail is “good.” Heatmap (Advanced/Pro) gives attention data but is advanced and tier-gated. Many users would benefit from a **single, easy-to-grasp signal** plus one-line suggestions—without needing to understand heatmaps.

### How it works

- **Score (e.g. 0–100 or “Good / Consider improving”):** Computed from a small set of criteria: clarity, contrast, text readability (if text present), face visibility (if face present), composition balance. Can use existing vision/analysis (e.g. style analysis, heatmap pipeline) to derive a simple aggregate.
- **Nudges:** One or two short, actionable lines: “Text in the corner is easy to read ✅” or “Consider increasing contrast for small previews.”
- **Placement:** Shown after generation (inline with thumbnail card) or in a lightweight “Review” panel. Never blocking; always “here’s what we noticed.”
- **Tier:** Score + nudges available to **Starter+** as a learning/confidence tool. Heatmap (full attention overlay) stays **Advanced/Pro** as the premium differentiator.

### Core benefits

- **Users:** ✅ Confidence and learning; sense of progress. Low-friction way to “get better” without reading articles.
- **Business:** Reduces perceived risk of “my thumbnail might be bad”; supports upgrade path (“See exactly where eyes go with Heatmap — Pro”).

### Technical considerations

- **Logic:** Reuse or extend existing analysis (e.g. `analyze-style`, heatmap backend) to output a small schema: score, 0–2 nudge strings. Cache per thumbnail so we don’t re-run on every view.
- **Copy:** Nudges must be encouraging, not critical—align with brand voice. Avoid “Your thumbnail is bad”; prefer “Strong contrast. For small previews, consider…”
- **Performance:** Score computation can be async after generation (queue or background) so generation latency isn’t affected.
- **⚠️ Expectations:** Set clear that “health” is heuristic (readability, composition), not a guarantee of CTR. Avoid over-promising.

### Alignment with product vision

💡 Fits “creator-centric value” and “data-driven decisions” in an accessible way. Complements heatmap without cannibalizing it. Brand: expert friend giving helpful, gentle feedback.

---

## Summary

| Priority | Feature | Designer lens |
|----------|---------|----------------|
| 🔴 High | Inspiration feed; Remix my best | Friction reduction (blank canvas, data-driven start); emotional pull |
| 🟡 Medium | Style quiz; Share-for-feedback; Health score | Emotional resonance (“we get you,” validation, confidence); clearer hierarchy and purpose |
| 🟢 Lower | Personal “my best” feed (Pro) | Retention and differentiation for power users |

All five features are designed to **reduce friction**, **increase confidence**, and **reinforce brand** (dark, focused, expert friend). They fit the existing stack and roadmap and can be phased: Style quiz and Health score are smaller, high-impact wins; Inspiration feed and Share-for-feedback build on existing surfaces (onboarding, share links); Remix my best aligns with Phase 2 YouTube and experiments.

---

*End of designer feature brainstorm. For product roadmap and architecture, see `master_plan.md`. For other feature ideas, see `new_features_brainstorm.md`.*
