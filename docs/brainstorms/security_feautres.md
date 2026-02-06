# Type: New Feature Brainstorm (Security)

**Document:** Security-focused feature ideas for ViewBait  
**Lens:** Senior Security Engineer — defensive design, risk mitigation, OWASP Top 10, data privacy, authentication & authorization  
**Generated:** 2025-02-05

This brainstorm proposes 3–5 innovative features that strengthen security, privacy, and resilience of ViewBait. It is grounded in the existing codebase: `requireAuth` / `requireAdmin`, RLS on core tables, Stripe webhook signature verification, SSRF-hardened proxy-image, path-ownership checks for storage, and error sanitization. Each feature addresses concrete risks (injection, abuse, auditability, misconfiguration, compliance) while remaining practical within the current stack (Next.js, Supabase, Stripe, Gemini).

---

## Overview

| # | Feature | Problem | Key benefit | Effort (est.) | Tier / gate | Status |
|---|---------|---------|-------------|---------------|-------------|--------|
| 1 | Security audit log & sensitive-action trail | No structured trail for auth events, credit changes, export, delete account, or admin actions; harder to detect abuse and comply with audits. | ✅ Auditability; 🔴 incident response; compliance (SOC2, GDPR evidence). | Medium | n/a (infra) | \|_\| |
| 2 | Input validation & prompt-injection hardening | User-controlled text (title, customStyle, thumbnailText) flows into Gemini prompts with limited sanitization; risk of prompt injection or abuse. | 🔴 OWASP A03 mitigation; 💡 safer AI pipeline; predictable behavior. | Medium | n/a | \|_\| |
| 3 | Distributed rate limiting & abuse signals | In-memory rate limit is per serverless instance; no cross-instance consistency; no anomaly detection for bursts or credential stuffing. | 🔴 Consistent abuse protection; cost control; OWASP A04 / A07. | Medium | n/a (infra) | \|_\| |
| 4 | Storage path hardening & upload integrity | Path ownership is checked but path traversal (e.g. `..`) and encoding tricks could be under-tested; no integrity verification for uploads. | ⚠️ OWASP A01/A05; defense in depth for storage; tamper detection. | Low–Medium | n/a | \|_\| |
| 5 | Data lifecycle & right-to-erasure workflow | Export exists; delete-account may not fully purge storage or downstream references; no clear retention/consent story for compliance. | ✅ GDPR/CCPA alignment; 💡 clear data lifecycle; reduced liability. | Medium | n/a | \|_\| |

**Status legend:** ✔ Done / in progress | ❌ Not doing / deprioritized | **\|_\|** To be / planned

---

## |_| 1. Security audit log & sensitive-action trail

**Status:** |_| — To be / planned

### Problem it solves

There is no centralized, structured log of security-sensitive actions. Detecting account takeover, credit abuse, or unauthorized admin use relies on ad-hoc logs. Compliance (SOC2, GDPR) and incident response need a consistent trail of who did what and when, without storing PII in plain text in logs.

### How it works

- **Audit events:** Emit structured events for: login success/failure, password reset, credit deduction (user + amount + route), subscription change (Stripe webhook id), account export request, account delete request, admin route access (e.g. `/api/admin/*`), and optionally role changes.
- **Storage:** Write to a dedicated `audit_logs` table (or append-only store) with: `event_type`, `user_id` (or hashed/anonymized for auth failures), `resource_type`, `resource_id`, `metadata` (JSON, no raw prompts or PII), `ip_hash` or request id, `created_at`. RLS: users see only their own events; admins see all (or via service role for support).
- **Retention:** Configurable retention (e.g. 90 days for non-admin, 1 year for admin actions); auto-purge or archive to cold storage. No logging of prompt content or full request bodies.
- **Integration:** Thin helper e.g. `auditLog(supabase, { eventType, userId, resourceType, resourceId, metadata })` called from route handlers and critical services; async/non-blocking so it does not slow the request path.

### Core benefits

- **Security:** ✅ Detect anomalies (e.g. many export or credit-deduct requests from one user); support forensics after a suspected breach.
- **Compliance:** 🔴 Evidence of “who accessed what” and “who deleted what” for GDPR/SOC2 and customer trust.
- **Operational:** Clear trail for support (“user says they didn’t delete X” → check audit).

### Technical considerations

- **Performance:** Audit write must be fire-and-forget or queued; never block the main response. Consider existing queue if one is added for generation.
- **Privacy:** Do not log PII (email, name) in metadata; use IDs and opaque resource references. Redact or hash IP if required by policy.
- **Schema:** Align with existing `supabase/tables/audit_logs.json` if present; otherwise add migration for `audit_logs` with RLS and retention policy.

### Alignment with product vision

Master Plan integration strategy: “Security: Auth at route level; RLS; … New features add … same RLS and no client secrets.” Audit log extends that to **observability of security-relevant actions** without changing app semantics.

---

## |_| 2. Input validation & prompt-injection hardening

**Status:** |_| — To be / planned

### Problem it solves

User-controlled fields (`title`, `customStyle`, `thumbnailText`, and any future free-text inputs to the generator or assistant) are sent to Gemini. Without strict validation and optional injection detection, malicious or accidental input could alter model behavior (prompt injection), leak system prompts, or cause unexpected output. This aligns with OWASP A03 (Injection).

### How it works

- **Centralized validation:** Introduce a shared validation layer (e.g. Zod schemas) for all API request bodies that touch the AI pipeline. Enforce max lengths (e.g. title 500 chars, customStyle 2000 chars), allowed character set or blocklist (e.g. no null bytes, no control characters), and type/shape.
- **Prompt-injection mitigations:** Before concatenating user input into prompts in `ai-core.ts`: (1) truncate to safe length per field; (2) apply a blocklist for known injection patterns (e.g. “ignore previous instructions”, “system:”, “```” used to break context); (3) optionally wrap user content in explicit delimiters in the prompt (e.g. “USER CONCEPT: … END USER CONCEPT”) so the model treats it as data. Do not expose detection logic to the client.
- **Error handling:** Invalid or blocked input returns 400 with a generic message (e.g. “Invalid input”); never echo back the offending string. Existing `sanitizeErrorForClient` and `validationErrorResponse` stay the single place for client-facing errors.
- **Assistant/chat routes:** Apply the same validation and delimiter strategy to user messages in `/api/assistant/chat` and `/api/agent/chat` so assistant context cannot be hijacked.

### Core benefits

- **Security:** 🔴 Reduces risk of prompt injection and model abuse; 💡 makes AI behavior more predictable.
- **Reliability:** Fewer malformed requests reaching Gemini; consistent error responses.
- **Compliance:** Demonstrates due care for user-generated content that drives AI output.

### Technical considerations

- **Maintainability:** Keep blocklist and rules in one module (e.g. `lib/server/utils/prompt-safety.ts`); document and test. Update as new attack patterns appear.
- **False positives:** Blocklist should be tuned to avoid blocking legitimate creative text; prefer allowlists or length limits where possible.
- **No silver bullet:** This reduces risk; it does not eliminate prompt injection. Combine with least-privilege prompts and monitoring.

### Alignment with product vision

Architect doc: “AI: Prompt construction and Gemini calls only in API routes and `lib/services/ai-core.ts`; errors sanitized before client.” This feature **hardens that boundary** with explicit input validation and prompt-safety rules.

---

## |_| 3. Distributed rate limiting & abuse signals

**Status:** |_| — To be / planned

### Problem it solves

`lib/server/utils/rate-limit.ts` uses an in-memory store. In serverless (Vercel), each instance has its own store, so an attacker can bypass limits by spreading requests across instances. There is no shared view of “this user or IP is abusing,” and no anomaly detection (e.g. burst of failed logins, or sudden spike in generate requests).

### How it works

- **Distributed rate limit:** Replace or back the existing `checkRateLimit()` with a Redis/Upstash-backed implementation (sliding or fixed window per key). Keep the same API so route handlers do not change. Key by `user_id` when authenticated, and by IP (or IP hash) when not. Apply to: `/api/generate`, `/api/auth/*` (login/signup), `/api/account/export`, and optionally other expensive or sensitive routes.
- **Tier-aware limits:** Use different limits per tier (e.g. free: 10/min, paid: higher or no limit for generate) so abuse protection does not punish paying users. Document limits in one config.
- **Abuse signals (optional):** Log or increment counters for: failed login attempts per email/IP, export requests per user per day, credit deductions per user per hour. Threshold-based alerts (e.g. > N failed logins in 5 min) can trigger temporary blocking or alerting. Do not store passwords or tokens; only counts and identifiers.
- **Fallback:** When Redis is unavailable, fall back to in-memory rate limit and log a warning so production degrades gracefully.

### Core benefits

- **Security:** 🔴 Consistent rate limiting across all instances; ⚠️ reduces credential stuffing and cost abuse (e.g. runaway generate calls).
- **Business:** Protects Gemini and Stripe from abuse; aligns with OWASP A04 (Broken Access Control) and A07 (Identification and Authentication Failures).

### Technical considerations

- **Dependencies:** Add Redis client (e.g. Upstash REST for serverless). Env var for Redis URL; feature flag or env check for production.
- **Privacy:** Rate-limit keys should be hashed if they contain PII (e.g. email); document retention for Redis keys (TTL per key).
- **Existing technical brainstorm:** “Distributed rate limit & cache (Redis/Upstash)” in `technical_feautres.md` — this security feature can be implemented together with that initiative, with rate limiting taking priority for security-critical routes.

### Alignment with product vision

Master Plan Phase 3: “Performance & reliability”; “rate limits and cost controls on Gemini.” Distributed rate limiting is the **security-facing** part of that same capability.

---

## |_| 4. Storage path hardening & upload integrity

**Status:** |_| — To be / planned

### Problem it solves

Storage signed-URL and export routes validate that the path “starts with” the user’s ID (`validatePathOwnership`). Path traversal (e.g. `..`, encoded `%2e%2e`) or bucket confusion could theoretically be under-tested. Uploads (faces, style references, thumbnails) are stored without integrity checks; a compromised or buggy client could upload unexpected content.

### How it works

- **Path validation:** In `signed-url`, `account/export`, and any route that builds storage paths from user input: (1) normalize the path (resolve `..` and `.`); (2) reject if the normalized path does not start with `{userId}/` or if it contains `..` or null bytes; (3) reject if path segments contain disallowed characters (e.g. newlines, leading/trailing spaces). Apply the same rules when generating upload paths in `/api/storage/upload`, `/api/faces/upload`, and thumbnail generation storage.
- **Bucket and path allowlist:** Already in place for signed-url (VALID_BUCKETS, PRIVATE_BUCKETS); ensure all code paths that touch storage use the same constants and never build paths from unsanitized query/body.
- **Upload integrity (optional):** For critical uploads (e.g. face images), optionally store a hash (e.g. SHA-256) in the DB when saving the file. Later, verify that the file at the stored path still matches the hash when serving or exporting. Detects accidental or malicious overwrites; does not replace RLS or path checks.
- **Tests:** Add unit tests for path validation: `../other_user/id`, `user_id/../other`, encoded variants, empty path, path longer than expected.

### Core benefits

- **Security:** ⚠️ OWASP A01 (Broken Access Control) and A05 (Security Misconfiguration) — defense in depth so one bug does not expose another user’s files.
- **Reliability:** Predictable behavior for malformed or malicious paths; clear 400/403 responses.

### Technical considerations

- **Backward compatibility:** Ensure normalized paths still match existing stored paths (e.g. `user_id/thumbnails/xyz`). No change to how files are named at upload time.
- **Performance:** Normalization and checks are cheap; hashing on upload adds one read + compute per file — optional and for high-value assets only.

### Alignment with product vision

Existing pattern: “path belongs to user” in signed-url and export. This feature **formalizes and hardens** that pattern and adds optional integrity for sensitive assets.

---

## |_| 5. Data lifecycle & right-to-erasure workflow

**Status:** |_| — To be / planned

### Problem it solves

Account export exists and supports GDPR-style portability. Account delete may not guarantee full purge of storage objects, notifications, feedback, or analytics references. There is no documented retention policy for thumbnails (e.g. free-tier cleanup exists in cron) or for audit logs. Consent for marketing or analytics is not clearly modeled.

### How it works

- **Delete-account workflow:** When a user requests account deletion: (1) invalidate session and auth; (2) delete or anonymize profile and user-scoped rows (thumbnails, styles, palettes, faces, experiments, projects, notifications, feedback, referrals, YouTube integrations, subscription rows) in a defined order to respect FKs; (3) delete all objects in storage under the user’s paths (thumbnails, faces, style-references buckets); (4) optionally anonymize audit log entries (replace user_id with “deleted_user” or hash); (5) return success only after all steps complete or after enqueueing a background job that does the same. Do not leave orphaned storage objects or rows that still reference the user.
- **Retention policy:** Document and implement: free-tier thumbnail retention (e.g. existing cron); how long audit logs are kept; how long Stripe-related data is kept (invoice IDs, etc.). Expose a high-level “Data retention” section in legal or help.
- **Consent (optional):** If marketing or non-essential analytics are added, store consent flags (e.g. `profiles.marketing_consent`, `profiles.analytics_consent`) and respect them in all flows; include in export and in delete workflow (purge or anonymize).
- **Export:** Keep existing export; ensure it includes all personal data that is stored (profiles, thumbnails metadata, projects, etc.) and that signed URLs in export have a short expiry (already 1 year — consider 7 days for “download your data” flow).

### Core benefits

- **Compliance:** ✅ GDPR/CCPA right to erasure and data minimization; 💡 clear data lifecycle reduces legal and trust risk.
- **Trust:** Users can rely on “delete my account” to actually remove their data.

### Technical considerations

- **Idempotency:** Delete workflow may be retried; use idempotent operations (e.g. “delete where user_id = X” rather than “delete row R”) so partial failure can be safely retried.
- **Stripe:** Stripe customer and subscription data may need to be retained for legal/tax; document that “we anonymize in our DB but Stripe retains per their policy” and link to Stripe’s documentation.
- **Backup/restore:** Define whether backups are purged on delete or retained for a fixed period; document in policy.

### Alignment with product vision

Ethical/trust pillar: “No dark patterns”; “Performance data is the user’s own.” A clear **data lifecycle and right-to-erasure** implementation reinforces that and supports future B2B or EU users who require compliance evidence.

---

## Summary (security lens)

| Feature | Priority | Main risk addressed |
|---------|----------|----------------------|
| Security audit log | 🔴 High — auditability and compliance | No trail for abuse or compliance evidence |
| Input validation & prompt-injection hardening | 🔴 High — AI safety | OWASP A03; unpredictable or abusive AI behavior |
| Distributed rate limiting & abuse signals | 🔴 High — abuse and cost | Bypass of per-instance limits; credential stuffing; cost spikes |
| Storage path hardening & upload integrity | 🟡 Medium — defense in depth | Path traversal; OWASP A01/A05 |
| Data lifecycle & right-to-erasure | 🟡 Medium — compliance and trust | GDPR/CCPA; incomplete delete; no retention story |

These five features are scoped to fit the current stack, reuse existing patterns (requireAuth, RLS, error sanitization, server-only secrets), and advance security and compliance without changing core product UX. Implementing audit log, input validation, and distributed rate limiting first addresses the highest-impact risks; storage hardening and data lifecycle complete the security and privacy posture.
