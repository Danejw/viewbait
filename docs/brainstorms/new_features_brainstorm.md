## Type: New Feature Brainstorm

These feature ideas aim to extend ViewBait’s core promise: generate fast, iterate faster, and stay consistent across a channel.

### 1) Channel Brand Kit
**Problem it solves**: Creators struggle to keep thumbnails consistent across series without re-deciding fonts, colors, and composition each time.

**How it works**:
- Users define a **Brand Kit** per channel or series: color palette defaults, preferred text treatment, logo usage rules, and “do not do” constraints.
- The generator and assistant automatically apply Brand Kit constraints when building prompts and suggesting variations.

**Core benefits**:
- Faster decisions for every new thumbnail.
- Stronger channel identity and recognizability.
- Better collaboration between teams (shared rules instead of ad hoc taste debates).

**Technical considerations and challenges**:
- New DB tables for brand kits and mappings to projects or channels.
- Prompt construction changes to consistently apply constraints without over-constraining creativity.
- UX for editing and previewing brand rules without feeling enterprise-heavy.

**Alignment with product vision**: Directly supports consistency through constraint and reduces time spent tweaking.

---

### 2) Auto Experiment Scheduler for YouTube
**Problem it solves**: Creators want A/B testing but do not want to manually swap thumbnails and track timings.

**How it works**:
- User selects 2 to 3 finalist thumbnails for a video.
- ViewBait schedules thumbnail swaps on a defined cadence (for example, every 6 hours) and logs performance windows.
- The system surfaces a simple “winner” recommendation with context.

**Core benefits**:
- Real experiments with minimal effort.
- Higher confidence in choosing a final thumbnail.
- Clear upgrade path tied to measurable outcomes.

**Technical considerations and challenges**:
- Requires YouTube API integration for setting thumbnails and reading analytics reliably under quota limits.
- Needs a scheduler (cron + job table) with idempotency, retries, and safe cancellation.
- Must be transparent about attribution limits (external factors, algorithm shifts).

**Alignment with product vision**: Makes iteration and testing feel seamless, not manual and stressful.

---

### 3) Thumbnail Critique Coach
**Problem it solves**: Many users can generate options but do not know which one will win and why.

**How it works**:
- Users upload an existing thumbnail or pick one from their gallery.
- The assistant returns a structured critique: clarity, focal point, emotion, contrast, text legibility, and “small-size” score.
- One click creates targeted variations that fix the top issues.

**Core benefits**:
- Helps non-designers learn quickly.
- Increases the quality of prompts and outcomes over time.
- Builds trust by explaining decisions in plain language.

**Technical considerations and challenges**:
- Needs vision analysis prompts that are consistent and do not leak sensitive data.
- Requires careful UX to keep feedback actionable, not overwhelming.

**Alignment with product vision**: The AI agent becomes the interface and the guide, not just a generator.

---

### 4) Shared Workspaces for Teams
**Problem it solves**: Teams (or creator plus editor) need shared styles, palettes, and approvals without passing files around.

**How it works**:
- Introduce **workspaces** with roles (owner, editor, viewer).
- Shared libraries: faces, styles, palettes, and project packs.
- Optional approval flow before a thumbnail is set on YouTube.

**Core benefits**:
- Enables teams and agencies, increasing lifetime value.
- Reduces duplicated setup work across collaborators.
- Improves accountability and version control for creative decisions.

**Technical considerations and challenges**:
- Tenancy shift from user-owned to workspace-owned assets with strict RLS.
- Migration path for existing user assets into a default workspace.
- Role-based access checks across API routes and UI.

**Alignment with product vision**: Extends the studio to real creator workflows where editors and collaborators are common.

---

### 5) Smart Prompt Builder for Thumbnail Hooks
**Problem it solves**: Users often write prompts that are either too vague or too detailed, leading to inconsistent results.

**How it works**:
- A guided prompt builder that asks 4 to 6 questions: hook type, emotion, subject, background, text style, and constraint level.
- Outputs a clean prompt plus optional custom instructions, and saves it as a reusable “hook recipe”.

**Core benefits**:
- Higher first-try success rate and fewer wasted credits.
- More predictable results for new users.
- Creates reusable workflows that scale across a content calendar.

**Technical considerations and challenges**:
- Needs a tight UX so it feels faster than free-form typing.
- Must integrate smoothly with the conversation-first workflow, not replace it.

**Alignment with product vision**: Improves speed over perfection by increasing first-pass quality and reusability.

