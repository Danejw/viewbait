# Master Brainstorm Compilation Plan (Revised)

> **Revision note:** This plan incorporates the critique in [master_brainstorm_compilation_critique.md](master_brainstorm_compilation_critique.md). Key changes: corrected "Current state" to match the repo (five brainstorm files; no standalone `master_plan.md`); expanded compilation scope to all five brainstorms; aligned security initiatives with `security_feautres.md`; fixed product-plan reference; added optional pre-step for `master_plan.md`; clarified Phase 2 and risk mitigations.

---

## Current state

> [CRITIQUE-BASED UPDATE] The following reflects the actual repo state as of the critique (2025-02-05).

- **[viewbait/docs/brainstorms/](viewbait/docs/brainstorms/)** contains **five** source files:
  - **[architect_features.md](viewbait/docs/brainstorms/architect_features.md)** — Master Plan (Part 1) + feature brainstorm (performance/A/B, one-click thumbnail, brand kits, batch, share-for-review).
  - **[designer_feautres.md](viewbait/docs/brainstorms/designer_feautres.md)** — UX/friction-reduction (inspiration feed, style quiz, remix my best, share-for-feedback, health score).
  - **[security_feautres.md](viewbait/docs/brainstorms/security_feautres.md)** — Security (audit log, input validation/prompt-injection, distributed rate limiting, storage path hardening, data lifecycle/right-to-erasure).
  - **[technical_feautres.md](viewbait/docs/brainstorms/technical_feautres.md)** — Infra/performance (Redis rate limit & cache, studio bootstrap, generate pipeline resilience, gallery virtualization, observability).
  - **[visionary_features.md](viewbait/docs/brainstorms/visionary_features.md)** — Strategic (CTR loop, video-to-thumbnail intelligence, Brand DNA, performance scoring, cohort insights).
- **Product-level Master Plan:** There is **no** standalone `viewbait/docs/master_plan.md`. The canonical product/architecture plan is **Part 1 — Master Plan** inside [architect_features.md](viewbait/docs/brainstorms/architect_features.md). All references in this plan to "master plan" or "product roadmap" point to that section (or to a new `docs/master_plan.md` if created in the optional pre-step below).
- Future brainstorms (e.g. marketing) may be added to `docs/brainstorms/` later; the master document structure should accommodate them.

## Objective

Produce **one** document that:

1. Serves as the single "master brainstorming session" by compiling **all** current brainstorm sources (architect, designer, security, technical, visionary).
2. Applies the ARCHITECT structure to that content: Executive Summary, System Architecture (where ideas plug in), Integration Strategy, Phased Roadmap, Risk Mitigation.
3. Surfaces the "best of the best" via one overview table and clear prioritization, so roadmap owners can scan and act.

## Deliverable: New document

**Path:** [viewbait/docs/brainstorms/master_brainstorm.md](viewbait/docs/brainstorms/master_brainstorm.md)

**Header:** `Type: Master Brainstorm (Compiled)` and a short intro stating that this document consolidates all brainstorm outputs and applies a solutions-architecture lens. **List all five source files** (architect_features.md, designer_feautres.md, security_feautres.md, technical_feautres.md, visionary_features.md); when additional brainstorm files (e.g. marketing) are added, include them in the list and in Source summaries.

---

## Optional pre-step (recommended by critique)

> [CRITIQUE-BASED UPDATE] To fix broken references and give a single product north star:

- **Option A:** Create [viewbait/docs/master_plan.md](viewbait/docs/master_plan.md) by extracting or summarizing **Part 1 — Master Plan** from [architect_features.md](viewbait/docs/brainstorms/architect_features.md) (Executive Summary, System Architecture, Integration Strategy, Phased Roadmap, Risk Mitigation). Add one line under "Related documents": "Brainstorm-derived initiatives are compiled in [docs/brainstorms/master_brainstorm.md](viewbait/docs/brainstorms/master_brainstorm.md)."
- **Option B:** Do not create a new file; in this plan and in the generated master_brainstorm.md, **reference** [architect_features.md](viewbait/docs/brainstorms/architect_features.md) and the section "Part 1 — Master Plan" wherever "master_plan.md" was previously referenced (e.g. "see Part 1 of architect_features.md for product roadmap").

If Option A is chosen, use `docs/master_plan.md` in the sections below; otherwise use "Part 1 of architect_features.md" or "docs/brainstorms/architect_features.md § Part 1."

---

## Document structure

### 1. Executive Summary

- **North Star for the brainstorm program:** e.g. "Highest-impact ideas from all brainstorms (product, security, design, technical, visionary) consolidated into one execution view; security and trust as differentiators; alignment with product vision and phases."
- One short paragraph tying the brainstorm initiatives to ViewBait's product vision ([agentics/VISION.md](viewbait/agentics/VISION.md)): conversation-first, creator trust, sustainable platform.
- No duplication of the product North Star (in [master_plan.md](viewbait/docs/master_plan.md) if created, or Part 1 of [architect_features.md](viewbait/docs/brainstorms/architect_features.md)); this summary is specific to *brainstorm-derived* initiatives across all five sources.

### 2. Overview table (best of the best)

Single table at the top for quick scan. Columns:

- **#** | **Initiative / area** | **Source** | **Objective** | **Key benefit** | **Priority** | **Status**

Rows populated from **all five** brainstorms. Source column values: "Architect", "Designer", "Security", "Technical", "Visionary" (or short file names). Priority/Status carried over from each source. Status values: ✔ Done / in progress, ❌ Not doing, **\|_\|** To be / planned (standardized; source brainstorms may use \|_\| or "O"—normalize to one convention in the master table).

> [CRITIQUE-BASED UPDATE] **Security rows** must match [security_feautres.md](viewbait/docs/brainstorms/security_feautres.md) exactly: (1) Security audit log & sensitive-action trail, (2) Input validation & prompt-injection hardening, (3) Distributed rate limiting & abuse signals, (4) Storage path hardening & upload integrity, (5) Data lifecycle & right-to-erasure workflow. Do **not** list "MFA" or "session management" as security brainstorm initiatives unless they are later added to that file or a separate product spec; they can be noted in Phase 2 as "Future / product backlog" if desired.

When additional brainstorm files exist (e.g. marketing), add rows with Source = the new file name or lens.

### 3. System architecture (brainstorm lens)

A short section describing **where** the brainstorm initiatives attach to the existing stack (reference the product master plan—[master_plan.md](viewbait/docs/master_plan.md) or Part 1 of [architect_features.md](viewbait/docs/brainstorms/architect_features.md)—and [system_understanding.md](viewbait/docs/system_understanding.md)):

**Security initiatives (from security_feautres.md):**

- **Security audit log:** New append-only table; writes from API routes (and optionally RPC); RLS for read (user sees own). No change to client or Gemini. Align with existing [supabase/tables/audit_logs.json](viewbait/supabase/tables/audit_logs.json) if schema exists.
- **Input validation & prompt-injection hardening:** API and AI layer; centralized validation (e.g. Zod) for request bodies; blocklist and delimiters in [lib/services/ai-core.ts](viewbait/lib/services/ai-core.ts); no prompt/PII to client (already in [security_principles.md](viewbait/docs/security_principles.md)).
- **API rate limiting:** API route layer; use existing [lib/server/utils/rate-limit.ts](viewbait/lib/server/utils/rate-limit.ts) and [rateLimitResponse](viewbait/lib/server/utils/error-handler.ts); later shared store (e.g. Redis/Upstash) for cross-instance. **Mitigation:** When Redis is unavailable, fall back to in-memory limiter so behavior is explicit (fail open for availability).
- **Storage path hardening & upload integrity:** Storage and upload paths; path traversal and encoding checks; optional integrity verification for uploads.
- **Data lifecycle & right-to-erasure:** Documentation and config (retention, cron); export/delete-account purge; optional future UI for granular delete; no new services, only clarity and policy.

**Other sources (architect, designer, technical, visionary):** One or two sentences per initiative type indicating layer (e.g. "Brand kits → DB + Generator state"; "Studio bootstrap → new API route + client hook"). Optional: one mermaid diagram per source (e.g. "Security initiatives → Stack layers") or one high-level "Initiative type → layer" diagram if it stays readable; avoid a single noisy diagram for all five sources.

### 4. Integration strategy

How the brainstorm initiatives align with existing perspectives:

- **Security vs product:** Audit log and input validation support "trust and safety" without slowing the core flow; rate limiting protects "speed over perfection" and cost.
- **Security vs UX:** Validation and step-up only where needed; no prompts or internals leaked (already in [security_principles.md](viewbait/docs/security_principles.md)).
- **Brainstorm vs product phases:** Map each initiative to the existing phases in the product master plan (Part 1 of architect_features.md or master_plan.md) (Phase 1–4) so the Master Brainstorm does not contradict the product roadmap.

### 5. Phased roadmap (brainstorm initiatives only)

Concrete ordering for *brainstorm* items only (not redefining the full product roadmap). Phases below focus on **security** from security_feautres.md; other sources (architect, designer, technical, visionary) should be mapped to the same Phase 1–4 in the product master plan and summarized in the master doc (e.g. "Architect Phase 2: … Designer Phase 1: …").

**Security (from security_feautres.md):**

- **Phase 1 (foundation):** Security audit log (platform, async writes); API rate limiting on critical routes (generate, assistant, account/export); input validation & prompt-injection hardening on generate and assistant routes; data classification as docs and retention policy. Rationale: no external Auth feature dependency; immediate risk reduction.
- **Phase 2 (hardening):** Storage path hardening & upload integrity; data lifecycle & right-to-erasure workflow (export/delete purge, retention policy). Rationale: builds on Phase 1; aligns with security brainstorm.
- **Phase 3 (scale & resilience):** Cross-instance rate limiting (Redis/Upstash) with fallback to in-memory when Redis unavailable; audit log retention and partitioning; optional granular PII delete UI.

> [CRITIQUE-BASED UPDATE] **MFA and session management** are not in [security_feautres.md](viewbait/docs/brainstorms/security_feautres.md). If the product backlog adds them later, Phase 2 can include a line: "Future: MFA (opt-in) and session list/revoke once Supabase Auth capabilities are confirmed and specified in a product/security spec." Do not commit Phase 2 to MFA/sessions until Supabase APIs and recovery flows are verified.

Exit criteria per phase: one sentence each (e.g. Phase 1: "Audit log table exists and is written for export/delete/login; generate and assistant routes return 429 when over limit; validation and injection mitigations applied; data map doc exists.").

### 6. Risk mitigation

Risks and mitigations **specific to the brainstorm initiatives** (not repeating the product master plan in full):

| Initiative | Risk | Mitigation |
|------------|------|------------|
| Audit log | Performance on hot paths; retention growth | Async/fire-and-forget writes; partitioning and lifecycle. |
| Input validation / prompt-injection | Complexity; false positives on blocklist | Centralized Zod schemas; generic 400 message; no echo of input. |
| Rate limiting | Serverless per-instance limits; Redis dependency | Document per-instance behavior; for global limits, Redis/Upstash with **fallback to in-memory when Redis unavailable** (fail open for availability). |
| Storage path hardening | Regression in existing upload flows | Tests for path traversal and encoding; defense in depth. |
| Data lifecycle | Retention changes require user communication and legal review | Document and gate behind policy; clear purge semantics for export/delete. |

### 7. Source summaries (condensed)

For **each** brainstorm source file, one subsection with a **condensed** "best of" from that file:

- **From Security (security_feautres.md):** One short paragraph plus the 5 initiative names and one-line pitch each: audit log = accountability and compliance; input validation & prompt-injection = OWASP A03 and predictable AI; distributed rate limiting = abuse protection and cost control; storage path hardening = path traversal and integrity; data lifecycle & right-to-erasure = GDPR/CCPA and clear purge. Link to [security_feautres.md](viewbait/docs/brainstorms/security_feautres.md) for full detail.
- **From Architect (architect_features.md):** Condensed summary of Part 2 feature brainstorm (performance/A/B, one-click thumbnail, brand kits, batch, share-for-review) and pointer to Part 1 for master plan. Link to file.
- **From Designer (designer_feautres.md):** Condensed summary (inspiration feed, style quiz, remix my best, share-for-feedback, health score). Link to file.
- **From Technical (technical_feautres.md):** Condensed summary (Redis, studio bootstrap, generate pipeline, gallery virtualization, observability). Link to file.
- **From Visionary (visionary_features.md):** Condensed summary (CTR loop, video-to-thumbnail intelligence, Brand DNA, performance scoring, cohort insights). Link to file.

When **marketing_strategy_brainstorm.md** (or others) exist, add a similar subsection and link.

---

## File placement and references

- **Create:** [viewbait/docs/brainstorms/master_brainstorm.md](viewbait/docs/brainstorms/master_brainstorm.md).
- **Do not remove or replace** any of the five source files; the master document references them as the source of truth for full feature write-ups.
- **Optional:** Add a one-line mention in the product master plan (Part 1 of architect_features.md or [master_plan.md](viewbait/docs/master_plan.md) if created): "Brainstorm-derived initiatives are compiled in [docs/brainstorms/master_brainstorm.md](viewbait/docs/brainstorms/master_brainstorm.md)."

---

## Implementation notes

- Use markdown only; no emojis in the master document (per ARCHITECT/plan rules). Source brainstorms can keep emojis; the master uses plain High/Medium/Low or "Priority: High" text.
- Status column: standardize on **\|_\|** for "To be / planned" across the master table (same as security_feautres.md).
- Keep the master document concise: overview table + short sections. Deep detail stays in the source brainstorms.
- Mermaid: if used, follow the project's mermaid rules (no spaces in node IDs, no HTML in labels, no reserved keywords as IDs). Prefer one diagram per source or one high-level diagram to avoid noise.

---

## Summary (implementation steps)

| Step | Action |
|------|--------|
| 0 (optional) | Create [viewbait/docs/master_plan.md](viewbait/docs/master_plan.md) by extracting Part 1 from architect_features.md, or confirm references use Part 1 of architect_features.md. |
| 1 | Create [viewbait/docs/brainstorms/master_brainstorm.md](viewbait/docs/brainstorms/master_brainstorm.md) with header and intro listing all five source files. |
| 2 | Add Executive Summary (North Star for brainstorm program; link to product vision and product master plan). |
| 3 | Add Overview table (all initiatives from all five brainstorms; Source, Objective, Benefit, Priority, Status). Security rows match security_feautres.md exactly. |
| 4 | Add System architecture (brainstorm lens): where each initiative plugs in (DB, Auth, API, docs); Redis fallback for rate limiting. |
| 5 | Add Integration strategy: security vs UX/product; alignment with product phases. |
| 6 | Add Phased roadmap for brainstorm items (security Phases 1–3 with exit criteria; other sources mapped to product phases). MFA/sessions only if added to product spec. |
| 7 | Add Risk mitigation table for these initiatives (including Redis fallback). |
| 8 | Add Source summaries: condensed "best of" from each of the five brainstorms with links. |
| 9 | Optionally add one sentence in the product master plan pointing to master_brainstorm.md. |

This yields one main master brainstorming document that compiles **all** current brainstorms and applies ARCHITECT structure so the best ideas are clear and actionable, with accurate references and security initiative alignment.
