# SOC 2 Readiness Audit Report - ViewBait

Date: 2026-02-11  
Auditor: SOC 2 Compliance Auditor AI  
Scope: Application codebase, API routes, Supabase integration, infra/config artifacts, docs, CI/CD evidence

## 1. Plain-English Overview (Short)
ViewBait is **not currently SOC 2 audit-ready**. The app has some strong technical controls (RLS-oriented data model, signed Stripe webhook verification, and authentication checks in many routes), but it is missing core operational controls and evidence that SOC 2 auditors require. The largest gaps are around **documented governance** (incident response, change management, access reviews), **continuous control enforcement** (CI/CD quality/security gates), and **centralized auditable monitoring**. Overall risk is **high** for audit failure because SOC 2 evaluates both technical safeguards and operating procedures. This app would **not realistically pass a SOC 2 Type I audit today**.

## 2. SOC 2 Readiness Score
**SOC 2 Readiness Score: 41 / 100**

### Weighted breakdown
- **Security (40%)**: 52/100 -> weighted 20.8
- **Availability (20%)**: 28/100 -> weighted 5.6
- **Processing Integrity (15%)**: 40/100 -> weighted 6.0
- **Confidentiality (15%)**: 45/100 -> weighted 6.75
- **Privacy (10%)**: 19/100 -> weighted 1.9

**Rationale:** The code shows real implementation effort on auth patterns, RLS migration intent, input validation, and webhook signature verification. However, the repository lacks critical SOC 2 governance artifacts and operational controls (incident response runbook, access review process, change management evidence, centralized immutable audit logs, and enforceable CI policy gates). Those missing controls are material blockers even if parts of the application security implementation are technically reasonable.

## 3. Summary Table of Findings

| Issue ID | Trust Criteria | Category | Severity | Description | Risk | Status |
|---|---|---|---|---|---|---|
| SOC2-001 | Security | Governance / Security Program | Critical | No incident response, access review, or formal security operations documentation in repo | Audit failure and slow breach response | Failing |
| SOC2-002 | Security, Processing Integrity | Change Management / SDLC | High | No CI/CD workflow definitions and build explicitly allows TypeScript build errors | Uncontrolled releases and defects in production | Failing |
| SOC2-003 | Security, Confidentiality | Logging & Audit Trail | High | Logging is console-based and no durable append-only audit log evidence for privileged actions | Weak forensic capability and weak compliance evidence | Failing |
| SOC2-004 | Availability | Resilience / BC-DR | High | No documented backups, recovery objectives, or service continuity runbooks | Outage/data-loss exposure and control deficiency | Failing |
| SOC2-005 | Security, Confidentiality | Access Control Hardening | Medium | Admin control relies on profile flag; no evidence of MFA enforcement or privileged access lifecycle | Privileged misuse or account takeover impact | Partial |
| SOC2-006 | Security | API Abuse Protection | Medium | No repo-level rate limiting/WAF protections across high-value API routes | Abuse, brute force, and cost amplification risk | Partial |
| SOC2-007 | Privacy | Privacy Program & Notice Quality | High | Privacy/Cookie docs are incomplete placeholders in sections and no DSR procedure docs | Regulatory exposure and audit exceptions | Failing |
| SOC2-008 | Processing Integrity | Test Assurance & Control Validation | Medium | Minimal automated test coverage in-repo and no evidence of required control tests in pipeline | Reduced confidence in control operation | Partial |

## 4. Detailed Issues (One Section Per Issue)

---

### Issue ID: SOC2-001
**Trust Criteria:** Security  
**Category:** Governance / Security Program  
**Severity:** Critical

**Plain English Description**  
SOC 2 is not just about code; it requires proof that your team can detect, escalate, and respond to security events in a disciplined way. This repository lacks basic governance artifacts (incident response process, periodic access review process, and formal change management policy) that auditors expect.

**Current State (What exists now)**  
Security principles exist at a high level, but there is no concrete incident playbook, on-call escalation process, evidence template, or access review cadence document in docs.

**Goal State (What SOC 2 expects)**  
Documented and approved policies with clear owners, SLAs, evidence artifacts, and recurring operating cadence. Typical required artifacts include incident response runbook, access review policy and logs, and change management procedures.

**Evidence (Touched Files / Code Paths / Docs)**
- High-level principles only, without operational runbooks: `docs/security_principles.md`
- No dedicated incident response/access review/change-management docs in `docs/`
- Project docs list product/feature/brainstorm materials but not SOC 2 operational controls

**Why This Matters (Risk)**  
A real incident may be mishandled, and auditors will treat missing formal controls as failures even if engineers are doing informal good practice.

**Proposed Fix (Technical + Process Direction)**
- Create `docs/security/incident_response.md` with severity matrix, response steps, roles, legal/notification flow, and postmortem template.
- Create `docs/security/access_review_policy.md` with quarterly review cadence, privileged role inventory, reviewer signoff.
- Create `docs/security/change_management_policy.md` requiring ticket linkage, reviewer approval, and production deploy authorization.
- Add lightweight evidence templates (monthly control checklist, incident log register, access review record).

**Unit Test / Control Validation Test**
- CI gate: fail if required policy files are missing.
- Monthly control check script: verifies latest signed review artifacts exist (date-based validation).

**Instructional Prompt for Coding Agent**
"Add SOC 2 governance documentation under `docs/security/` including `incident_response.md`, `access_review_policy.md`, and `change_management_policy.md`. Add a CI script that fails if these files are missing and another script that validates a monthly evidence folder contains dated review artifacts."

---

### Issue ID: SOC2-002
**Trust Criteria:** Security, Processing Integrity  
**Category:** Change Management / SDLC  
**Severity:** High

**Plain English Description**  
There is no visible CI/CD workflow in the repository, and the Next.js config is set to ignore TypeScript build errors. That combination means risky code can be deployed without strong automated control checks.

**Current State (What exists now)**  
Build scripts and lint/typecheck commands exist in `package.json`, but no GitHub Actions workflows are present. Additionally, `next.config.ts` explicitly sets `typescript.ignoreBuildErrors = true`.

**Goal State (What SOC 2 expects)**  
Every production-bound change should be validated by required automated controls: lint, typecheck, tests, dependency/security checks, and approval-based deployment workflow.

**Evidence (Touched Files / Code Paths / Docs)**
- Command definitions exist: `package.json`
- No `.github/workflows/*` found in repo
- Build allows type errors: `next.config.ts`

**Why This Matters (Risk)**  
Without enforced gates, defects and security regressions can enter production, undermining processing integrity and weakening audit evidence for change control.

**Proposed Fix (Technical + Process Direction)**
- Add GitHub Actions workflows for PR and main branch with mandatory steps: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:run`.
- Remove or strictly justify `ignoreBuildErrors`; require successful typecheck prior to release.
- Add branch protection requirements and CODEOWNERS for sensitive directories (`app/api`, `lib/server`, `supabase/migrations`).

**Unit Test / Control Validation Test**
- CI policy test: PR fails if any required checks fail.
- Config lint: script asserts `typescript.ignoreBuildErrors !== true` in release profile.

**Instructional Prompt for Coding Agent**
"Implement GitHub Actions workflows that enforce lint, typecheck, and tests on pull requests. Remove permissive typecheck bypass in `next.config.ts` or gate it behind non-production mode. Add CODEOWNERS and branch protection documentation for critical folders."

---

### Issue ID: SOC2-003
**Trust Criteria:** Security, Confidentiality  
**Category:** Logging & Audit Trail  
**Severity:** High

**Plain English Description**  
The app logs with useful redaction, but evidence of durable tamper-resistant audit logging is missing. SOC 2 requires you to prove who did what, when, and from where for sensitive actions.

**Current State (What exists now)**  
Server logger writes structured JSON to console in production. There is a table artifact for `audit_logs`, but exported schema details are empty and no clear privileged action audit pipeline is evident.

**Goal State (What SOC 2 expects)**  
Privileged and security-sensitive actions must emit immutable audit events to a centralized retained store with access control, retention policy, and queryability for investigations.

**Evidence (Touched Files / Code Paths / Docs)**
- Structured console logging utility: `lib/server/utils/logger.ts`
- Test exists for redaction logic: `lib/server/utils/logger.test.ts`
- `audit_logs` export appears incomplete/no policies listed: `supabase/tables/audit_logs.json`
- Notification broadcast is privileged admin action but lacks explicit persistent audit trail write: `app/api/notifications/broadcast/route.ts`

**Why This Matters (Risk)**  
If abuse or breach occurs, you may not have trustworthy evidence for forensic investigation or auditor verification.

**Proposed Fix (Technical + Process Direction)**
- Add append-only `audit_events` table with strict RLS and service-role insert-only path.
- Create `logAuditEvent` server utility and call it in privileged routes (admin broadcasts, account deletion, subscription/credit mutations, webhook processing).
- Configure log forwarding to SIEM provider and define retention + integrity policy.

**Unit Test / Control Validation Test**
- Route tests asserting each privileged route writes an audit event.
- Daily monitoring assertion for missing audit events on privileged endpoints.

**Instructional Prompt for Coding Agent**
"Implement persistent audit logging for privileged actions. Add `lib/server/audit.ts` and instrument `app/api/notifications/broadcast/route.ts`, account management routes, and webhook handlers. Create tests that fail if privileged actions do not emit an audit event."

---

### Issue ID: SOC2-004
**Trust Criteria:** Availability  
**Category:** Resilience / BC-DR  
**Severity:** High

**Plain English Description**  
There is no clear evidence of backup, disaster recovery, recovery objectives, or continuity documentation. SOC 2 availability controls require planned resilience, not just hope.

**Current State (What exists now)**  
Application and database integrations exist, and there is a cron cleanup endpoint, but no backup/restore runbooks, RTO/RPO targets, or continuity documentation are present.

**Goal State (What SOC 2 expects)**  
Documented backup strategy, tested restore process, defined RTO/RPO, monitoring/alerting path, and periodic disaster recovery exercises.

**Evidence (Touched Files / Code Paths / Docs)**
- Scheduled maintenance endpoint with shared secret only: `app/api/cron/cleanup-free-tier-thumbnails/route.ts`
- No BC/DR or backup policy docs in `docs/`
- Security principles mention availability concepts but no operational implementation runbook: `docs/security_principles.md`

**Why This Matters (Risk)**  
A platform outage or data corruption event can cause extended downtime and inability to recover customer data fast enough.

**Proposed Fix (Technical + Process Direction)**
- Publish `docs/security/business_continuity_disaster_recovery.md` with RTO/RPO by system.
- Define Supabase backup and restore verification cadence; document owner and evidence capture.
- Add uptime/latency/error budget monitoring and alerting runbook.

**Unit Test / Control Validation Test**
- Quarterly restore exercise checklist with signoff artifact.
- Synthetic health checks with alert test proving paging path works.

**Instructional Prompt for Coding Agent**
"Add BC/DR documentation with explicit RTO/RPO, backup ownership, and restore test procedure. Add health-check endpoint(s) and monitoring assertions. Include a script/checklist template for quarterly restore validation evidence."

---

### Issue ID: SOC2-005
**Trust Criteria:** Security, Confidentiality  
**Category:** Access Control Hardening  
**Severity:** Medium

**Plain English Description**  
The app enforces authentication and has admin checks, but there is no visible evidence of stronger privileged account controls like mandatory MFA and lifecycle review.

**Current State (What exists now)**  
Middleware and route-level auth patterns exist. Admin actions rely on `profiles.is_admin` checks and service-role writes in some paths.

**Goal State (What SOC 2 expects)**  
Defined privileged access lifecycle: MFA for admins, approval workflow for granting admin role, periodic recertification, and deprovisioning controls.

**Evidence (Touched Files / Code Paths / Docs)**
- Middleware authentication and protected routes: `middleware.ts`
- Admin gating by profile flag: `app/api/notifications/broadcast/route.ts`
- Service role client used for elevated operations: `lib/supabase/service.ts`
- No policy doc describing privileged access lifecycle

**Why This Matters (Risk)**  
A compromised privileged account can perform high-impact actions with limited detective controls.

**Proposed Fix (Technical + Process Direction)**
- Enforce MFA requirement for users with `is_admin = true` (via auth provider policy and app-side checks).
- Add privileged role grant/revoke SOP with ticket and approval trail.
- Add quarterly admin access certification.

**Unit Test / Control Validation Test**
- Integration test: admin-only endpoint returns 403 when admin lacks MFA claim.
- Monthly script: compare admin list against approved access register.

**Instructional Prompt for Coding Agent**
"Implement privileged access hardening: require MFA claim for admin-only routes and add enforcement checks in `app/api/notifications/broadcast/route.ts`. Add documentation and validation scripts for admin access review and approval evidence."

---

### Issue ID: SOC2-006
**Trust Criteria:** Security  
**Category:** API Abuse Protection  
**Severity:** Medium

**Plain English Description**  
Most routes do input validation, but there is no repository-level evidence of generalized API rate limiting or abuse protection for expensive endpoints.

**Current State (What exists now)**  
Many API routes exist, including generation/assistant endpoints and publicly accessible routes. No common rate-limit middleware/control framework is visible.

**Goal State (What SOC 2 expects)**  
Rate limiting, abuse detection, and anomaly alerting on sensitive endpoints, with consistent enforcement and measurable thresholds.

**Evidence (Touched Files / Code Paths / Docs)**
- Large API surface under `app/api/**`
- No explicit rate-limit implementation patterns found in server routes/config
- Terms mention rate limiting policy text, but technical enforcement evidence is unclear: `app/legal/terms.md`

**Why This Matters (Risk)**  
API abuse can drive outage, cost spikes, and security incidents that affect availability and confidentiality.

**Proposed Fix (Technical + Process Direction)**
- Implement shared rate limiter middleware/utility for high-cost routes (generate, assistant, image proxy, auth-sensitive actions).
- Add alert thresholds for spikes in 4xx/5xx and token usage.
- Document anti-abuse policy with owner and tuning cadence.

**Unit Test / Control Validation Test**
- Automated tests proving requests above threshold get 429.
- Monitoring test for alert emission when threshold breached.

**Instructional Prompt for Coding Agent**
"Add centralized API rate limiting for high-risk routes. Create reusable middleware/util and enforce it on generation and assistant endpoints. Add tests that verify 429 responses after threshold and include alerting metrics emission."

---

### Issue ID: SOC2-007
**Trust Criteria:** Privacy  
**Category:** Privacy Program & Notice Quality  
**Severity:** High

**Plain English Description**  
The project includes legal pages, but privacy compliance quality is uneven and some placeholders are unresolved. SOC 2 Privacy criteria require operational controls, not just long policy text.

**Current State (What exists now)**  
Privacy policy is detailed, but cookie policy still has placeholder values and no documented process for handling formal data subject requests (verification, SLA, escalation, denial logging).

**Goal State (What SOC 2 expects)**  
Complete and accurate privacy notices plus operational privacy procedures (DSR intake, identity verification, completion evidence, retention/deletion governance).

**Evidence (Touched Files / Code Paths / Docs)**
- Privacy notice present: `app/legal/privacy.md`
- Cookie policy contains unresolved placeholders (date/contact): `app/legal/cookie-policy.md`
- Account export/delete endpoints exist: `app/api/account/export/route.ts`, `app/api/account/delete/route.ts`
- No dedicated privacy operations runbook in `docs/`

**Why This Matters (Risk)**  
Incomplete notices and missing operational process can create compliance violations and customer trust issues.

**Proposed Fix (Technical + Process Direction)**
- Resolve placeholder fields and align legal docs with actual data processing behavior.
- Add `docs/privacy/data_subject_request_procedure.md` and response SLA policy.
- Add DSR case tracking template and monthly privacy metrics review.

**Unit Test / Control Validation Test**
- Docs lint to fail on placeholder tokens like `[Date will be set on deployment]`.
- Workflow check ensuring account export/delete actions produce auditable records.

**Instructional Prompt for Coding Agent**
"Finalize privacy and cookie policy placeholders and add a DSR operations runbook under `docs/privacy/`. Add a docs validation script that fails CI when unresolved legal placeholders exist. Instrument account export/delete endpoints to produce auditable DSR event records."

---

### Issue ID: SOC2-008
**Trust Criteria:** Processing Integrity  
**Category:** Test Assurance & Control Validation  
**Severity:** Medium

**Plain English Description**  
SOC 2 wants evidence that controls actually work over time. This repository has very limited automated tests relative to its API footprint.

**Current State (What exists now)**  
Testing dependencies/scripts exist, but only one visible unit test file is present and no CI evidence enforces ongoing control validation.

**Goal State (What SOC 2 expects)**  
Risk-based test suite covering authZ, data integrity paths, webhook idempotency, privileged actions, and error handling with repeatable CI execution evidence.

**Evidence (Touched Files / Code Paths / Docs)**
- Test tooling scripts exist: `package.json`
- Single visible test file: `lib/server/utils/logger.test.ts`
- API surface is broad (`app/api/**`) without corresponding visible route-level tests

**Why This Matters (Risk)**  
Controls may silently regress, causing data integrity issues and failed audit walkthroughs.

**Proposed Fix (Technical + Process Direction)**
- Add route/service integration tests prioritized by risk (auth required routes, webhook verification/idempotency, admin endpoints, deletion/export operations).
- Create control test matrix mapping SOC 2 controls to automated tests.
- Enforce minimum PR check coverage for critical folders.

**Unit Test / Control Validation Test**
- Add critical-path integration tests with fixtures/mocks for Supabase and Stripe.
- CI gate requiring test execution and artifact retention.

**Instructional Prompt for Coding Agent**
"Create a SOC 2 control test suite for critical API endpoints (authz, webhook signature/idempotency, admin-only operations, account delete/export). Add a control-test matrix document and enforce test execution in CI for every PR."

## 5. Final State Summary

- **Current SOC 2 maturity level:** **Pre-audit**
- **Top 3 blockers preventing SOC 2 audit readiness:**
  1. Missing governance and operational control documentation (incident response, access reviews, change management).
  2. Missing enforceable CI/CD control gates and permissive build settings.
  3. Missing durable auditable evidence pipeline for privileged/security events.

### Recommended remediation order for maximum audit impact
1. **Governance foundations first**: incident response, access review, change management, control ownership/evidence templates.
2. **Pipeline enforcement second**: required CI checks, branch protection, eliminate permissive build bypass for production.
3. **Auditability third**: persistent audit event model + SIEM/log retention.
4. **Availability/privacy hardening fourth**: BC/DR docs + restore drills, DSR operational runbooks, legal document completeness.
5. **Control effectiveness last mile**: risk-based integration tests mapped to SOC 2 controls.

---

## OPTIONAL: JSON EXPORT

```json
{
  "soc2_score": 41,
  "risk_level": "high",
  "summary": "ViewBait is not SOC 2 audit-ready. Core technical controls exist in places, but major governance, CI enforcement, and auditable operations controls are missing.",
  "issues": [
    {
      "id": "SOC2-001",
      "trust_criteria": "Security",
      "category": "Governance / Security Program",
      "severity": "critical",
      "description": "Missing incident response, access review, and change management operational documentation.",
      "current_state": "Only high-level security principles exist; no concrete runbooks or evidence procedures.",
      "goal_state": "Approved operational security policies with owners, cadence, and evidence artifacts.",
      "files": ["docs/security_principles.md", "docs/"],
      "risk": "Audit failure and delayed/ineffective incident handling.",
      "proposed_fix": "Add incident response, access review, and change management policies plus evidence templates.",
      "unit_test": "CI check for required policy files and monthly evidence artifacts.",
      "agent_prompt": "Add SOC 2 governance docs and CI checks for policy/evidence presence."
    },
    {
      "id": "SOC2-002",
      "trust_criteria": "Security, Processing Integrity",
      "category": "Change Management / SDLC",
      "severity": "high",
      "description": "No CI workflows in repo and Next build allows TypeScript errors.",
      "current_state": "Scripts exist but no enforceable PR pipeline; ignoreBuildErrors is enabled.",
      "goal_state": "Mandatory CI gates and protected release path with lint/type/test checks.",
      "files": ["package.json", "next.config.ts"],
      "risk": "Defects/security regressions can reach production without detection.",
      "proposed_fix": "Add GitHub Actions, branch protections, and remove permissive build bypass.",
      "unit_test": "CI gate plus config assertion against ignoreBuildErrors in production.",
      "agent_prompt": "Implement CI workflows and tighten production type safety enforcement."
    },
    {
      "id": "SOC2-003",
      "trust_criteria": "Security, Confidentiality",
      "category": "Logging & Audit Trail",
      "severity": "high",
      "description": "No durable tamper-evident audit trail for privileged actions.",
      "current_state": "Console structured logs with redaction; no clear persistent privileged action audit sink.",
      "goal_state": "Append-only audit events with retention/integrity controls and queryable evidence.",
      "files": ["lib/server/utils/logger.ts", "supabase/tables/audit_logs.json", "app/api/notifications/broadcast/route.ts"],
      "risk": "Poor forensics and weak compliance evidence during incidents or audits.",
      "proposed_fix": "Add persistent audit event utility/table and instrument privileged paths.",
      "unit_test": "Route tests assert audit event emission.",
      "agent_prompt": "Instrument privileged routes with persistent audit event logging and tests."
    },
    {
      "id": "SOC2-004",
      "trust_criteria": "Availability",
      "category": "Resilience / BC-DR",
      "severity": "high",
      "description": "No backup/restore or disaster recovery program evidence.",
      "current_state": "No BC/DR docs or restore drill evidence in repo.",
      "goal_state": "Documented and tested BC/DR plans with RTO/RPO and ownership.",
      "files": ["docs/security_principles.md", "app/api/cron/cleanup-free-tier-thumbnails/route.ts", "docs/"],
      "risk": "Prolonged outages and inability to recover data reliably.",
      "proposed_fix": "Add BC/DR runbook and recurring restore validation process.",
      "unit_test": "Quarterly restore drill artifact check and health alert test.",
      "agent_prompt": "Create BC/DR docs and restore validation evidence workflow."
    },
    {
      "id": "SOC2-005",
      "trust_criteria": "Security, Confidentiality",
      "category": "Access Control Hardening",
      "severity": "medium",
      "description": "Privileged controls exist but no MFA/lifecycle evidence for admin access.",
      "current_state": "Admin checks rely on profile flag; no explicit MFA enforcement evidence.",
      "goal_state": "MFA-required privileged access with periodic recertification and deprovision process.",
      "files": ["middleware.ts", "app/api/notifications/broadcast/route.ts", "lib/supabase/service.ts"],
      "risk": "Compromised privileged account can cause high-impact harm.",
      "proposed_fix": "Require MFA for admin routes and implement access lifecycle procedures.",
      "unit_test": "Admin route should deny access if MFA claim absent.",
      "agent_prompt": "Enforce MFA claim for admin routes and add admin review controls."
    },
    {
      "id": "SOC2-006",
      "trust_criteria": "Security",
      "category": "API Abuse Protection",
      "severity": "medium",
      "description": "No clear global rate-limiting controls for API surface.",
      "current_state": "Many endpoints with validation but no centralized throttling control evidence.",
      "goal_state": "Consistent rate limiting and abuse monitoring on sensitive endpoints.",
      "files": ["app/api/", "app/legal/terms.md"],
      "risk": "Abuse can cause downtime, cost spikes, and broader security issues.",
      "proposed_fix": "Add shared rate limiter and alerts for abuse anomalies.",
      "unit_test": "429 threshold tests plus alert trigger validation.",
      "agent_prompt": "Implement centralized API rate limiting and verification tests."
    },
    {
      "id": "SOC2-007",
      "trust_criteria": "Privacy",
      "category": "Privacy Program & Notice Quality",
      "severity": "high",
      "description": "Legal/privacy docs include placeholders and no DSR operating procedure evidence.",
      "current_state": "Privacy page exists; cookie policy has unresolved placeholders.",
      "goal_state": "Complete notices plus operational DSR workflow and auditable records.",
      "files": ["app/legal/privacy.md", "app/legal/cookie-policy.md", "app/api/account/export/route.ts", "app/api/account/delete/route.ts"],
      "risk": "Regulatory and customer trust risk.",
      "proposed_fix": "Finalize legal docs and add DSR runbook with evidence tracking.",
      "unit_test": "Docs lint for unresolved placeholders and DSR audit record assertion.",
      "agent_prompt": "Finalize legal placeholders and implement privacy operations runbook + checks."
    },
    {
      "id": "SOC2-008",
      "trust_criteria": "Processing Integrity",
      "category": "Test Assurance & Control Validation",
      "severity": "medium",
      "description": "Minimal automated tests relative to API complexity.",
      "current_state": "Only one visible test file and no CI evidence of recurring control validation.",
      "goal_state": "Risk-based endpoint/control tests with enforced CI execution.",
      "files": ["package.json", "lib/server/utils/logger.test.ts", "app/api/"],
      "risk": "Control drift and production defects without early detection.",
      "proposed_fix": "Add critical integration tests and SOC 2 control-test matrix.",
      "unit_test": "Required test suite execution in CI with artifacts.",
      "agent_prompt": "Create SOC 2 control test suite and enforce it in PR pipeline."
    }
  ]
}
```
