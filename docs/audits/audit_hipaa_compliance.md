# HIPAA Compliance Audit Report

**Repository:** ViewBait  
**Audit Date:** 2026-02-11  
**Auditor:** AI HIPAA Compliance Auditor

## 1. Plain-English Overview (Short)
This application is **not HIPAA compliant** in its current state. The biggest risks are uncontrolled third-party PHI processing (Gemini and other vendors), missing formal breach/incident controls, and insufficient PHI-safe logging/storage practices. Several controls are partially present (authentication checks, some RLS), but critical HIPAA administrative and auditability safeguards are missing or undocumented. Overall risk is **high** if PHI is handled. This app is **not safe to handle PHI today** without a substantial compliance hardening program.

## 2. HIPAA Compliance Score
**HIPAA Compliance Score: 28 / 100**

**Rationale:**
- **Technical safeguards (40%)**: Some auth/RLS controls exist, but PHI can be exposed via public sharing, long-lived signed URLs, debug logs, and client localStorage. Encryption/key-management guarantees are not demonstrated end-to-end.
- **Administrative safeguards (30%)**: No documented HIPAA risk analysis, incident response runbook, breach workflow, workforce controls, or designated security/privacy roles found.
- **Vendor / BAA readiness (20%)**: Multiple third-party processors are used, but no BAA evidence appears in repository docs.
- **Auditability & monitoring (10%)**: Logging exists, but mostly console-based with no immutable audit trail, alerting pipeline, or HIPAA-grade access monitoring.

## 3. Summary Table of Findings

| Issue ID | Category | Severity | HIPAA Rule | Description | Risk | Status |
|---|---|---|---|---|---|---|
| HIPAA-001 | Third-Party Services | Critical | Security Rule / Privacy Rule | PHI-capable data is sent to external AI/services without BAA evidence. | Vendor non-compliance, unlawful PHI disclosure | Failing |
| HIPAA-002 | Incident Response | Critical | Breach Notification Rule | No breach notification/incident response procedure documented. | Delayed/incorrect breach handling | Failing |
| HIPAA-003 | Logging | High | Security Rule | Assistant route prints full AI/function outputs (potential PHI) to logs. | PHI leakage via logs | Failing |
| HIPAA-004 | Data Minimization | High | Privacy Rule / Security Rule | Chat content is persisted in browser localStorage. | PHI persists on unmanaged endpoints | Failing |
| HIPAA-005 | Encryption | High | Security Rule | Signed URLs are issued with 1-year expiry for sensitive media. | Long exposure window if links leak | Failing |
| HIPAA-006 | Authorization | High | Privacy Rule | Features allow making user media publicly accessible. | Inadvertent PHI publication | Failing |
| HIPAA-007 | Authorization | High | Security Rule | RLS/storage coverage gaps noted for referenced tables/buckets. | Potential cross-tenant or unauthorized access | Partial |
| HIPAA-008 | Auditability | High | Security Rule | No clear immutable PHI access audit pipeline or SIEM alerting. | Undetected misuse/intrusion | Failing |
| HIPAA-009 | Backup & Recovery | Medium | Security Rule | Backup/recovery and contingency controls are vendor-assumed, not operationalized. | Extended outage/data loss + compliance exposure | Partial |
| HIPAA-010 | Administrative Safeguards | Critical | Security Rule / Privacy Rule | No HIPAA governance artifacts (risk analysis, policies, workforce controls) in-repo. | Structural non-compliance | Failing |

## 4. Detailed Issues

### Issue ID: HIPAA-001
**Category:** Third-Party Services  
**Severity:** Critical  
**HIPAA Rule Violated:** Security Rule / Privacy Rule

**Plain English Description**  
The app sends user-provided image/text content to external AI and service vendors, but the repository shows no evidence those vendors are under HIPAA Business Associate Agreements (BAAs).

**Current State (What exists now)**  
Gemini is used for image/text generation; policy/docs list Supabase, Stripe, Resend, and Google OAuth as integrated processors. PHI-capable content (images, prompts) is transmitted to AI services.

**Goal State (What HIPAA expects)**  
All vendors that create, receive, maintain, or transmit PHI must be contractually covered (BAA), with documented permitted uses, safeguards, and subcontractor controls.

**Evidence (Touched Files / Code Paths)**
- `lib/services/ai-core.ts` (Gemini API calls with user content)
- `app/legal/privacy.md` (third-party services and AI processing disclosures)
- `app/legal/terms.md` (third-party dependency references)
- No repository evidence of BAA documentation or HIPAA vendor matrix

**Why This Matters (Risk)**  
If PHI flows to vendors without BAAs, the organization is exposed to direct HIPAA violations even if technical controls are strong.

**Proposed Fix (Technical Direction)**  
Create a `docs/compliance/vendor_inventory.md` and `docs/compliance/baa_register.md` that map each processor to data classes, PHI touchpoints, BAA status, and allowed environments. Add runtime feature flags that block PHI workflows unless vendor BAA status is `approved`.

**Unit Test / Validation Test**  
Static policy test: CI check fails if `baa_register.md` lacks entries for every processor used in `package.json` + legal docs + outbound service modules.

**Instructional Prompt for Coding Agent**  
"Implement a vendor compliance gate. Add `docs/compliance/baa_register.md` and `docs/compliance/vendor_inventory.md`. Add a CI script (`scripts/validate-baa.js`) that scans service integrations (Gemini, Supabase, Stripe, Resend, Google OAuth) and fails when any PHI-capable vendor has no `baa_status: approved`. Wire this check into CI." 

---

### Issue ID: HIPAA-002
**Category:** Incident Response  
**Severity:** Critical  
**HIPAA Rule Violated:** Breach Notification Rule

**Plain English Description**  
There is no operational breach response procedure defining who investigates incidents, how evidence is preserved, and how notifications are issued within regulatory timelines.

**Current State (What exists now)**  
The repository contains product/legal docs but no incident response runbook, breach classification matrix, notification templates, or on-call escalation process.

**Goal State (What HIPAA expects)**  
A written and testable incident response + breach notification process with timelines, roles, evidence handling, and communication workflow.

**Evidence (Touched Files / Code Paths)**
- `README.md` (no security operations process)
- `docs/` (no HIPAA incident/breach runbook file detected)

**Why This Matters (Risk)**  
Late or incorrect breach handling can multiply patient harm and trigger serious enforcement penalties.

**Proposed Fix (Technical Direction)**  
Add `docs/compliance/incident_response.md` and `docs/compliance/breach_notification.md`. Include severity matrix, 24-hour triage SLA, forensic log retention, and notification automation steps.

**Unit Test / Validation Test**  
CI docs test: require mandatory sections (roles, timeline, notification triggers, regulator notice steps) in both runbooks.

**Instructional Prompt for Coding Agent**  
"Create HIPAA incident-response and breach-notification runbooks in `docs/compliance/`. Add a CI validator script that fails if required sections are missing (`incident commander`, `containment`, `forensics`, `breach determination`, `notification timelines`, `postmortem`)." 

---

### Issue ID: HIPAA-003
**Category:** Logging  
**Severity:** High  
**HIPAA Rule Violated:** Security Rule

**Plain English Description**  
The assistant API logs full function outputs and form updates, which may include sensitive user-generated text or image-related metadata.

**Current State (What exists now)**  
`console.log` statements emit raw function call payloads and form updates in assistant chat flow.

**Goal State (What HIPAA expects)**  
Only minimum necessary metadata should be logged, with PHI-safe redaction and centralized access-controlled retention.

**Evidence (Touched Files / Code Paths)**
- `app/api/assistant/chat/route.ts` (debug console logs for function results/form updates)

**Why This Matters (Risk)**  
Operational logs are broadly accessible in many platforms. Logging PHI creates an avoidable secondary breach surface.

**Proposed Fix (Technical Direction)**  
Remove raw payload logs, route all events through `logInfo/logError` with strict schema allowing only request IDs, user hash, route, timing, and status. Add denylist redaction for prompt/content fields.

**Unit Test / Validation Test**  
Jest/Vitest static test that forbids `console.log` in `app/api/**` except approved wrappers; test redaction helper with PHI-like strings.

**Instructional Prompt for Coding Agent**  
"Refactor `app/api/assistant/chat/route.ts` to remove direct `console.log` of AI outputs. Use `logInfo/logError` with a safe context schema. Add tests in `lib/server/utils/logger.test.ts` and a lint rule/test that blocks raw console logging in API routes." 

---

### Issue ID: HIPAA-004
**Category:** Data Minimization  
**Severity:** High  
**HIPAA Rule Violated:** Privacy Rule / Security Rule

**Plain English Description**  
Assistant chat content is stored in browser localStorage, which is unmanaged endpoint storage and not appropriate for PHI.

**Current State (What exists now)**  
Docs explicitly describe localStorage persistence of chat history content and settings.

**Goal State (What HIPAA expects)**  
PHI should not persist in unmanaged browser storage unless strongly justified and protected; prefer ephemeral memory or encrypted server-side session stores with retention controls.

**Evidence (Touched Files / Code Paths)**
- `docs/browser-storage.md` (chat history persisted in localStorage)
- `lib/hooks/useLocalStorage.ts` (generic write/read persistence in browser storage)

**Why This Matters (Risk)**  
Shared devices, malware, browser extensions, or physical access can expose local PHI artifacts.

**Proposed Fix (Technical Direction)**  
Disable local persistence for PHI-capable fields. Add a `phiSafe` mode to storage hooks that blocks writes for chat content and any patient-context fields.

**Unit Test / Validation Test**  
Unit test asserting assistant chat state is not written to localStorage when `phiSafe` is enabled.

**Instructional Prompt for Coding Agent**  
"Implement PHI-safe storage behavior: do not persist assistant conversation content to localStorage. Add a `phiSafe` option in `useLocalStorage` and migrate assistant chat state to in-memory/session-only mode. Add tests verifying no localStorage writes for chat content keys." 

---

### Issue ID: HIPAA-005
**Category:** Encryption  
**Severity:** High  
**HIPAA Rule Violated:** Security Rule

**Plain English Description**  
Sensitive media signed URLs are often generated for up to one year, creating long-lived access tokens.

**Current State (What exists now)**  
Signed URLs are generated with `SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS` in export/storage and media workflows.

**Goal State (What HIPAA expects)**  
Access tokens for PHI media should be short-lived, revocable, and tied to strict purpose/session context.

**Evidence (Touched Files / Code Paths)**
- `app/api/account/export/route.ts` (signed URL generation with one-year expiry)
- `app/api/storage/signed-url/route.ts` (default expiry one year)
- `app/api/generate/route.ts` (signed URLs returned for generated images)

**Why This Matters (Risk)**  
If URLs leak through logs, browser history, referrers, or screenshots, long validity increases breach impact dramatically.

**Proposed Fix (Technical Direction)**  
Reduce signed URL TTL to minutes, implement refresh endpoint requiring active auth + purpose check, and add mass revocation support.

**Unit Test / Validation Test**  
API integration test ensuring signed URL TTL <= 900 seconds unless privileged override is explicitly set server-side.

**Instructional Prompt for Coding Agent**  
"Replace one-year signed URL defaults with short TTL (e.g., 5–15 minutes) across storage/export/generation routes. Add a secure refresh endpoint requiring authentication and ownership checks. Add tests confirming max TTL enforcement." 

---

### Issue ID: HIPAA-006
**Category:** Authorization  
**Severity:** High  
**HIPAA Rule Violated:** Privacy Rule

**Plain English Description**  
The product includes mechanisms to make user assets public/shareable, which can expose PHI if users upload patient-related content.

**Current State (What exists now)**  
Routes allow toggling `is_public` and exposing project galleries without auth.

**Goal State (What HIPAA expects)**  
PHI-capable environments should default to non-public data handling, with explicit compliance-gated sharing controls and de-identification requirements.

**Evidence (Touched Files / Code Paths)**
- `app/api/styles/[id]/public/route.ts`
- `app/api/thumbnails/[id]/public/route.ts`
- `app/api/palettes/[id]/public/route.ts`
- `app/api/projects/share/[slug]/route.ts` (public no-auth gallery endpoint)

**Why This Matters (Risk)**  
Accidental one-click publication of patient-linked visuals can create immediate reportable disclosures.

**Proposed Fix (Technical Direction)**  
Introduce `HIPAA_MODE` that disables all public sharing endpoints and `is_public` toggles. Require compliance-admin override + warning workflow in non-HIPAA mode.

**Unit Test / Validation Test**  
Route tests asserting `/public` and `/share` endpoints return `403` when `HIPAA_MODE=true`.

**Instructional Prompt for Coding Agent**  
"Add `HIPAA_MODE` configuration and block all public sharing endpoints/toggles when enabled. Update the four routes to return 403 in HIPAA mode and add tests for each route behavior under both modes." 

---

### Issue ID: HIPAA-007
**Category:** Authorization  
**Severity:** High  
**HIPAA Rule Violated:** Security Rule

**Plain English Description**  
Repository history indicates RLS/storage policy coverage is incomplete for some referenced tables and storage buckets.

**Current State (What exists now)**  
Core RLS exists for several tables, but prior in-repo audit flags missing policies for additional referenced tables/storage paths.

**Goal State (What HIPAA expects)**  
All PHI-adjacent tables and storage objects must have explicit least-privilege policies, consistently versioned in migrations.

**Evidence (Touched Files / Code Paths)**
- `supabase/migrations/006_rls_core_tables.sql` (RLS for selected tables)
- `docs/audits/audit_supabase_rls_storage.md` (documented gaps for additional tables/storage policies)

**Why This Matters (Risk)**  
Even one unprotected table/bucket can undermine otherwise-strong tenant isolation.

**Proposed Fix (Technical Direction)**  
Perform a full schema-to-code table inventory; add missing RLS/storage migrations; add CI policy-lint that fails on table references without migration policy declarations.

**Unit Test / Validation Test**  
Schema validation script comparing referenced table names in code to policy coverage manifest.

**Instructional Prompt for Coding Agent**  
"Build a schema-policy coverage check. Enumerate Supabase tables referenced in `app/` and `lib/` and fail CI if any table lacks declared RLS policy coverage in migrations. Add missing migrations for uncovered tables and storage buckets." 

---

### Issue ID: HIPAA-008
**Category:** Auditability  
**Severity:** High  
**HIPAA Rule Violated:** Security Rule

**Plain English Description**  
The app has logging utilities but lacks evidence of centralized immutable audit logs and active security monitoring.

**Current State (What exists now)**  
Logging is console-based with redaction helpers; schema hints at `audit_logs` table but no concrete RLS/policy/use evidence in repo exports.

**Goal State (What HIPAA expects)**  
Track all PHI read/write access events with immutable records, actor IDs, purpose, and anomaly alerting.

**Evidence (Touched Files / Code Paths)**
- `lib/server/utils/logger.ts` (console output logger)
- `supabase/tables/SCHEMA_SUMMARY.md` and `supabase/tables/audit_logs.json` (audit table presence but incomplete schema/policies)

**Why This Matters (Risk)**  
Without robust audit trails, unauthorized PHI access may go undetected and uninvestigated.

**Proposed Fix (Technical Direction)**  
Create write-only audit event service + table migration with strict append-only semantics and alerting integrations.

**Unit Test / Validation Test**  
Integration test: PHI endpoint access writes one immutable audit event with actor, action, object, timestamp, and outcome.

**Instructional Prompt for Coding Agent**  
"Implement an append-only audit logging subsystem for PHI operations. Add migration for `audit_logs` with RLS preventing updates/deletes, create a server helper to record events on every PHI endpoint, and add integration tests for event creation and immutability." 

---

### Issue ID: HIPAA-009
**Category:** Backup & Recovery  
**Severity:** Medium  
**HIPAA Rule Violated:** Security Rule

**Plain English Description**  
Backup handling is described as vendor-managed but lacks documented restore testing, RTO/RPO targets, and contingency procedures.

**Current State (What exists now)**  
Privacy text references provider-managed backups; no in-repo disaster recovery runbook or test evidence found.

**Goal State (What HIPAA expects)**  
Documented contingency plan with tested backup restoration and defined recovery objectives.

**Evidence (Touched Files / Code Paths)**
- `app/legal/privacy.md` (backup statement is provider-level)
- `docs/` (no disaster recovery runbook found)

**Why This Matters (Risk)**  
During outages or corruption events, inability to restore data reliably can become both safety and compliance failures.

**Proposed Fix (Technical Direction)**  
Add DR runbook (`docs/compliance/disaster_recovery.md`) with quarterly restore drills and evidence artifacts.

**Unit Test / Validation Test**  
Operational validation: scheduled CI task checks existence and freshness of restore drill evidence files.

**Instructional Prompt for Coding Agent**  
"Create a disaster recovery and backup validation framework in docs/compliance. Add a script that verifies quarterly restore drill evidence and fails CI when evidence is older than SLA." 

---

### Issue ID: HIPAA-010
**Category:** Administrative Safeguards  
**Severity:** Critical  
**HIPAA Rule Violated:** Security Rule / Privacy Rule

**Plain English Description**  
Core HIPAA governance artifacts are missing (risk analysis, workforce access policy, sanction policy, periodic review cadence).

**Current State (What exists now)**  
Repository has engineering and product docs, but no HIPAA governance package.

**Goal State (What HIPAA expects)**  
Maintain living compliance documents and evidence for risk management, training, role-based access governance, and policy enforcement.

**Evidence (Touched Files / Code Paths)**
- `AGENTS.md` and `agentics/*.md` (engineering process docs, not HIPAA governance artifacts)
- `docs/` (no dedicated HIPAA administrative safeguard documentation found)

**Why This Matters (Risk)**  
Technical controls alone do not satisfy HIPAA. Missing governance is a direct compliance blocker.

**Proposed Fix (Technical Direction)**  
Create `docs/compliance/hipaa/` with required policy set: risk analysis, risk management plan, workforce access + termination, training, sanctions, periodic access review, and policy review schedule.

**Unit Test / Validation Test**  
Compliance manifest test: CI verifies required HIPAA policy documents exist and include owner/review date/version fields.

**Instructional Prompt for Coding Agent**  
"Establish a HIPAA administrative safeguards documentation package under `docs/compliance/hipaa/` with required policy templates and ownership metadata. Add CI validation ensuring all mandatory files exist and are not stale." 

## 5. Final State Summary
- **Current HIPAA maturity level:** **Pre-compliance**
- **Top 3 blocking issues:**
  1. No BAA/vendor compliance evidence for PHI-capable processors (HIPAA-001)
  2. Missing breach notification and incident response program (HIPAA-002)
  3. Missing HIPAA administrative governance artifacts (HIPAA-010)

### Recommended Execution Order
1. **Governance + Vendor Legality first**: complete BAA register, HIPAA policy baseline, incident/breach runbooks.
2. **Stop PHI leakage vectors**: remove raw debug logging, disable local PHI persistence, shorten signed URL TTLs, disable public sharing in HIPAA mode.
3. **Hard technical assurance**: close all RLS/storage gaps, implement immutable audit logging + alerting, and establish backup/restore evidence.
4. **Validate continuously**: add CI compliance checks and recurring operational drills.

---

## OPTIONAL: JSON EXPORT

```json
{
  "hipaa_score": 28,
  "risk_level": "critical",
  "summary": "Not HIPAA compliant. High-risk gaps exist in vendor/BAA readiness, breach response, PHI-safe logging/storage, and administrative safeguards.",
  "issues": [
    {
      "id": "HIPAA-001",
      "category": "Third-Party Services",
      "severity": "Critical",
      "rule": "Security Rule / Privacy Rule",
      "description": "PHI-capable data is sent to vendors without BAA evidence.",
      "current_state": "Gemini and other external services are integrated, but no BAA inventory is documented.",
      "goal_state": "All PHI-touching vendors are contractually covered and tracked in a compliance register.",
      "files": ["lib/services/ai-core.ts", "app/legal/privacy.md", "app/legal/terms.md"],
      "risk": "Unlawful PHI disclosure and severe regulatory exposure.",
      "proposed_fix": "Add vendor inventory + BAA register with CI enforcement and PHI feature gating.",
      "unit_test": "CI static check fails when PHI-capable vendors lack approved BAA status.",
      "agent_prompt": "Implement vendor compliance gating with docs/compliance/baa_register.md, inventory docs, and CI validation."
    },
    {
      "id": "HIPAA-002",
      "category": "Incident Response",
      "severity": "Critical",
      "rule": "Breach Notification Rule",
      "description": "No breach response workflow is documented.",
      "current_state": "No incident/breach runbooks found in docs.",
      "goal_state": "Documented, testable breach triage and notification process.",
      "files": ["README.md", "docs/"],
      "risk": "Delayed breach handling and legal penalties.",
      "proposed_fix": "Create incident_response.md and breach_notification.md with SLAs and workflows.",
      "unit_test": "CI docs validator requires mandatory breach/incident sections.",
      "agent_prompt": "Author HIPAA incident and breach runbooks and add CI validation for required sections."
    },
    {
      "id": "HIPAA-003",
      "category": "Logging",
      "severity": "High",
      "rule": "Security Rule",
      "description": "Assistant route logs raw payloads that may contain PHI.",
      "current_state": "Raw function results and form updates are printed via console.log.",
      "goal_state": "Only sanitized, minimum-necessary metadata is logged.",
      "files": ["app/api/assistant/chat/route.ts"],
      "risk": "PHI leakage in operational logs.",
      "proposed_fix": "Remove raw logs and enforce structured redacted logging.",
      "unit_test": "Static test/lint forbids raw console logging in API routes.",
      "agent_prompt": "Refactor assistant chat logging to sanitized logger utilities and add anti-console policy tests."
    },
    {
      "id": "HIPAA-004",
      "category": "Data Minimization",
      "severity": "High",
      "rule": "Privacy Rule / Security Rule",
      "description": "Chat content is persisted in localStorage.",
      "current_state": "Browser storage docs confirm chat history persistence.",
      "goal_state": "No PHI persistence in unmanaged browser storage.",
      "files": ["docs/browser-storage.md", "lib/hooks/useLocalStorage.ts"],
      "risk": "Endpoint compromise exposes stored PHI.",
      "proposed_fix": "Disable PHI storage in localStorage and move to ephemeral/session-safe handling.",
      "unit_test": "Hook test verifies no localStorage writes for assistant chat keys in PHI-safe mode.",
      "agent_prompt": "Add phiSafe local storage mode and migrate assistant chat away from persistent localStorage."
    },
    {
      "id": "HIPAA-005",
      "category": "Encryption",
      "severity": "High",
      "rule": "Security Rule",
      "description": "Signed URLs for sensitive files use long (1-year) TTL.",
      "current_state": "Routes use SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS.",
      "goal_state": "Short-lived and revocable access URLs.",
      "files": ["app/api/account/export/route.ts", "app/api/storage/signed-url/route.ts", "app/api/generate/route.ts"],
      "risk": "Leaked links expose data for extended periods.",
      "proposed_fix": "Reduce TTL to minutes and add re-authenticated refresh flow.",
      "unit_test": "Integration test enforces max signed URL TTL <= 900 seconds.",
      "agent_prompt": "Lower signed URL TTL globally, add refresh endpoint, and test TTL enforcement."
    },
    {
      "id": "HIPAA-006",
      "category": "Authorization",
      "severity": "High",
      "rule": "Privacy Rule",
      "description": "Public-sharing routes can expose user media.",
      "current_state": "Routes toggle is_public and expose share pages without auth.",
      "goal_state": "Public sharing disabled for HIPAA-sensitive deployments.",
      "files": ["app/api/styles/[id]/public/route.ts", "app/api/thumbnails/[id]/public/route.ts", "app/api/palettes/[id]/public/route.ts", "app/api/projects/share/[slug]/route.ts"],
      "risk": "Accidental publication of PHI-bearing media.",
      "proposed_fix": "Add HIPAA_MODE guardrail to block public endpoints.",
      "unit_test": "Route tests assert 403 for public/share endpoints in HIPAA_MODE.",
      "agent_prompt": "Implement HIPAA_MODE and deny public sharing endpoints when enabled with route tests."
    },
    {
      "id": "HIPAA-007",
      "category": "Authorization",
      "severity": "High",
      "rule": "Security Rule",
      "description": "Policy coverage appears incomplete for all referenced tables/buckets.",
      "current_state": "Core RLS exists, but in-repo audit lists uncovered objects.",
      "goal_state": "Complete RLS/storage policy coverage for every referenced object.",
      "files": ["supabase/migrations/006_rls_core_tables.sql", "docs/audits/audit_supabase_rls_storage.md"],
      "risk": "Unauthorized or cross-tenant access through uncovered data objects.",
      "proposed_fix": "Inventory references and enforce migration coverage via CI.",
      "unit_test": "Schema-policy coverage checker in CI.",
      "agent_prompt": "Create table-reference vs RLS-coverage validator and add missing migrations."
    },
    {
      "id": "HIPAA-008",
      "category": "Auditability",
      "severity": "High",
      "rule": "Security Rule",
      "description": "No demonstrated immutable PHI access audit pipeline.",
      "current_state": "Console logging utilities exist; audit table details/policies are incomplete in repo exports.",
      "goal_state": "Append-only auditable access events with monitoring and alerts.",
      "files": ["lib/server/utils/logger.ts", "supabase/tables/SCHEMA_SUMMARY.md", "supabase/tables/audit_logs.json"],
      "risk": "Security incidents may go undetected or unverifiable.",
      "proposed_fix": "Implement audit event service and immutable storage schema with alert integrations.",
      "unit_test": "Integration test ensures PHI endpoint creates immutable audit event.",
      "agent_prompt": "Build append-only audit logging for PHI operations with tests for event creation and immutability."
    },
    {
      "id": "HIPAA-009",
      "category": "Backup & Recovery",
      "severity": "Medium",
      "rule": "Security Rule",
      "description": "Backup/restore contingency controls are not operationalized in-repo.",
      "current_state": "Backup statements rely on provider policy references.",
      "goal_state": "Documented and tested contingency and restore process with RTO/RPO.",
      "files": ["app/legal/privacy.md", "docs/"],
      "risk": "Outage or corruption without proven recovery workflow.",
      "proposed_fix": "Add DR runbook and restore drill evidence process.",
      "unit_test": "Scheduled CI check for recent restore drill evidence.",
      "agent_prompt": "Create disaster recovery runbook and automate stale-evidence detection in CI."
    },
    {
      "id": "HIPAA-010",
      "category": "Administrative Safeguards",
      "severity": "Critical",
      "rule": "Security Rule / Privacy Rule",
      "description": "No HIPAA governance policy package is present.",
      "current_state": "Engineering docs exist but not HIPAA administrative safeguards.",
      "goal_state": "Documented risk management, workforce, sanctions, and periodic review policies.",
      "files": ["AGENTS.md", "agentics/PROJECT_FACTS.md", "docs/"],
      "risk": "Structural compliance failure independent of technical controls.",
      "proposed_fix": "Create docs/compliance/hipaa policy set with ownership and review cadence.",
      "unit_test": "CI manifest check for required HIPAA policy files and freshness metadata.",
      "agent_prompt": "Create HIPAA administrative safeguards documentation package and CI policy completeness checks."
    }
  ]
}
```
