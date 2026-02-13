# Type: New Feature Brainstorm

**Product:** ViewBait — AI-powered thumbnail studio for YouTube and video creators  
**Date:** 2026-02-13  
**Scope:** Innovative features that are both visionary and practically implementable within the current stack (Next.js App Router, Supabase, Stripe, Gemini).

This document proposes 3–5 new feature ideas that extend beyond the existing roadmap items in [Vision & Feature Roadmap](../audits/audit_vision_feature_roadmap.md) (notably § C.1–C.15). Each idea is grounded in the system’s current capabilities described in [System Understanding](../system_understanding.md) and the YouTube agent architecture described in [Assistant Implementation](../assistant_implementation.md).

---

## 1. Experiment-Informed Iteration Loop (“What should I try next?”)

### Problem it solves

Creators can run A/B experiments, but they often don’t know what to do with the result. “B won” is helpful, but it doesn’t tell them *why* it won or what to iterate next.

### How it works

When an experiment completes, ViewBait generates a short **Iteration Brief**:

- **What likely caused the lift** (1–3 cues in plain language)
- **What to keep** (winner traits)
- **What to change next** (2–4 concrete next variations)
- **One-click actions**: “Generate 4 variants based on winner” and “Generate challenger variants”

This uses the same “tool-call + summarization” pattern already in the Pro YouTube agent. The system feeds the model structured inputs: experiment metadata, the winning/losing thumbnail images (signed URLs), and any available YouTube analytics deltas.

### Benefits

- **Users:** Faster iteration after a test, less guesswork, more learning per experiment.
- **Business:** Makes experiments sticky, reinforces Pro value (“data-informed creative”), increases generation volume in a way that feels justified.

### Technical considerations

- **Inputs:** Use existing experiment entities plus thumbnail signed URLs from the storage URL refresh utilities described in `docs/system_understanding.md`.
- **Safety:** Never claim guaranteed CTR. Frame as “signals” and “hypotheses.”
- **Cost control:** Use a small vision call with a strict response schema (short bullets + suggested next steps).
- **Implementation path:** Add a server endpoint like `GET /api/experiments/[id]/iteration-brief` that:
  - Authenticates user and loads experiment + variants under RLS
  - Pulls analytics if connected (via existing agent tool patterns)
  - Calls Gemini and returns a structured brief
- **Caching:** Brief can be cached per experiment id (invalidate if new data arrives).

### Alignment with product vision

This turns “high-converting thumbnails” into a repeatable learning loop and makes the agent feel like a true collaborator, not just a generator.

---

## 2. Shareable Review Boards (Vote + Comment on a Set)

### Problem it solves

Creators rarely decide alone. They ask friends, editors, or Discord which thumbnail is best, but exporting files and collecting feedback is messy and slow.

### How it works

From a Project or a batch of generated thumbnails, users create a **Review Board** link:

- A clean, read-only page showing 4–12 thumbnails
- Viewers can **vote** (pick one or rank) and optionally **leave comments**
- The creator sees aggregated results in Studio (“Most voted,” “Common feedback themes”)

Boards can be time-limited, password-protected, or restricted to “anyone with link.” The creator can also “lock” a board once a winner is chosen.

### Benefits

- **Users:** Faster, higher-quality decisions and fewer “which one?” blocks.
- **Business:** Viral loop (links get shared), more retention (people come back to see results), clear Pro upsell (more boards, more participants, advanced insights).

### Technical considerations

- **Privacy:** Boards must never expose private user data beyond the intended thumbnails and minimal metadata.
- **Storage:** Prefer serving images via short-lived signed URLs or a dedicated public view that enforces board access rules.
- **Schema:** New tables like `review_boards`, `review_board_items`, `review_votes`, `review_comments` with clear ownership (`user_id`) and strict RLS.
- **Abuse controls:** Rate limiting for votes/comments; optional captcha for public boards.
- **UX:** One action in Results/Gallery: “Create review link.”

### Alignment with product vision

It supports speed and iteration while keeping the UI simple: generate options, get feedback, pick a winner, move on.

---

## 3. Hook and Text Variations Studio (10 clickable options)

### Problem it solves

Many thumbnails fail because the **hook text** is weak or too long, not because the image is bad. Creators often get stuck on the wording.

### How it works

Add a lightweight “Hook Variations” feature in Studio:

- User provides video title (or selects from connected YouTube video metadata)
- ViewBait generates 10 short hook text options optimized for thumbnail constraints (2–5 words, high contrast, curiosity)
- One click applies a hook to **Thumbnail Text** and optionally queues a quick regenerate (“Generate 4 with this hook”)

This can be powered by a text-only model call (cheaper than image generation) and is most valuable before spending credits on generation.

### Benefits

- **Users:** Better outcomes with fewer generations, less writer’s block.
- **Business:** Improved time-to-first-good-thumbnail and perceived “thumbnail intelligence.”

### Technical considerations

- **Constraints:** Enforce length rules and provide “safe alternatives” (avoid all-caps spam, avoid banned words if we add them).
- **Cost:** Text-only call with strict JSON output.
- **Placement:** Manual tab near Thumbnail Text, plus an assistant suggestion (“Want 10 hook options?”).
- **Telemetry:** Track which hooks convert into generation and favorites (future learning loop).

### Alignment with product vision

It makes “AI guidance” real and immediate while keeping the experience fast and creator-friendly.

---

## 4. Multi-Format Export Pack (YouTube + Shorts + TikTok)

### Problem it solves

Creators repurpose content across platforms. They want a consistent visual identity, but each platform has different aspect ratios and safe areas.

### How it works

From a single “hero” thumbnail, users can create a **Multi-Format Pack**:

- YouTube thumbnail (16:9)
- Shorts/TikTok cover (9:16) with safe-area guidance
- Instagram (1:1) variant

The pack can be generated as “same concept, reframed” (not just a crop) and exported as a ZIP with consistent naming. The assistant can drive the flow: “Make this a Shorts cover too.”

### Benefits

- **Users:** One idea becomes a full distribution kit, faster.
- **Business:** Strong Pro/value story; more reasons to return per video.

### Technical considerations

- **Generation strategy:** Offer two modes:
  - “Smart crop” (fast, no extra model call) for quick variants
  - “Reframe and regenerate” (extra credits) for better composition
- **Safe areas:** Add overlays/guides in the UI to prevent text in bad regions.
- **Limits:** Tier-gate pack size and regeneration mode to control cost.
- **Export:** Server endpoint to bundle selected signed URLs into a ZIP (or client-side ZIP for MVP).

### Alignment with product vision

It keeps the “speed over perfection” ethos while expanding the product from “a thumbnail” to “a creator’s visual kit.”

---

## Summary Table

| # | Feature | Problem | Key benefit | Effort (est.) | Tier / gate |
|---|---------|---------|--------------|---------------|-------------|
| 1 | Experiment-Informed Iteration Loop | Experiments don’t teach next steps | Faster learning + better iterations | M | Pro (best with YouTube) |
| 2 | Shareable Review Boards | Feedback collection is messy | Better picks, viral loop | M | All (limits for Free) |
| 3 | Hook and Text Variations Studio | Text hooks block quality | Better hooks before spending credits | S–M | All (enhanced for Pro) |
| 4 | Multi-Format Export Pack | Repurposing is manual | One concept, many platforms | M | Starter+ (regen mode Pro) |

---

*This brainstorm is intended to seed roadmap discussions. Implementation order should be decided against current priorities (activation, retention, “apply” loop, experimentation) and cost constraints.*
