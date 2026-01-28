# Agent Guidelines

**This file defines the workflow and rule precedence for coding agents.** Read this first, then follow the reading plan below.

---

## Required Reading (In Order)

### 1. Foundation Facts
- **[agentics/PROJECT_FACTS.md](./agentics/PROJECT_FACTS.md)** - Product identity, stack, commands, tenancy model. **Read first** to understand the repo.

### 2. Core Constraints (Highest Precedence)
- **[docs/database_security_principles.md](./docs/database_security_principles.md)** - Hard constraints for all database changes. **MUST READ** before any DB work.
- **[agentics/ARCHITECTURE.md](./agentics/ARCHITECTURE.md)** - System boundaries, data flows, folder conventions, no-go zones.
- **[agentics/TESTING_CONSTITUTION.md](./agentics/TESTING_CONSTITUTION.md)** - TDD workflow, test requirements, coverage rules.

### 3. Design and Structure
- **[agentics/DESIGN_PRINCIPLES.md](./agentics/DESIGN_PRINCIPLES.md)** - Visual design system, UI patterns.
- **[agentics/mobile_first_principles.md](./agentics/mobile_first_principles.md)** - Mobile-first UI requirements.
- **[agentics/PROJECT_STRUCTURE.md](./agentics/PROJECT_STRUCTURE.md)** - Directory structure, file organization.

### 4. Additional Context
- **[agentics/VISION.md](./agentics/VISION.md)** - Product vision and goals (read when relevant).
- **[docs/security_principles.md](./docs/security_principles.md)** - General security guidelines (read when relevant).
- **[docs/optimization_principles.md](./docs/optimization_principles.md)** - Performance guidelines (read when relevant).

---

## Rule Precedence

When rules conflict, apply in this order:

1. **Security & Database Rules** (highest)
   - `docs/database_security_principles.md` - RLS, service role, PII, audit logs
   - `docs/security_principles.md` - Input validation, least privilege, CIA triad

2. **Architecture Boundaries**
   - `agentics/ARCHITECTURE.md` - System boundaries, data flows, folder conventions

3. **Quality & Testing**
   - `agentics/TESTING_CONSTITUTION.md` - TDD, test coverage, verification

4. **Design & Structure**
   - `agentics/DESIGN_PRINCIPLES.md` - UI patterns, styling
   - `agentics/mobile_first_principles.md` - Mobile-first requirements
   - `agentics/PROJECT_STRUCTURE.md` - File organization

5. **Product Context**
   - `agentics/VISION.md` - Product goals
   - `agentics/PROJECT_FACTS.md` - Product facts, branding

**Principle:** Security and database rules override all other concerns. Architecture boundaries override design preferences. Quality gates override style choices.

---

## Stop Conditions

**STOP and redesign if any of these occur:**

- ❌ **Service role keys in client code** - Service role must never be used in browser
- ❌ **Bypassing or weakening RLS** - Never disable RLS or use service role to bypass policies
- ❌ **Unclear tenancy boundary** - Every table must have clear `user_id` or `org_id` ownership
- ❌ **Storing/logging sensitive PII without reason** - Must document why PII is needed
- ❌ **DB change without deletion/retention plan** - All tables must have lifecycle strategy
- ❌ **Change fails quality gate** - Tests must pass, lint must pass, types must be correct
- ❌ **Direct table access from client** - Use views or API routes, never direct table queries
- ❌ **Business logic in components** - Extract to services, hooks, or RPC functions
- ❌ **No tests for new feature** - TDD requires tests before implementation

**If stopped:** Consult the relevant doc, redesign to comply, then proceed.

---

## Required Workflow

### Step 1: Read Foundation
1. Read `agentics/PROJECT_FACTS.md` to understand stack, commands, tenancy
2. Read `agentics/ARCHITECTURE.md` to understand system boundaries

### Step 2: Read Constraints
1. If touching database: Read `docs/database_security_principles.md`
2. If touching security: Read `docs/security_principles.md`
3. Read `agentics/TESTING_CONSTITUTION.md` for test requirements

### Step 3: Design
1. Identify trust boundaries and data flows
2. Determine tenancy model (single vs multi-tenant)
3. Design with RLS, views, and RPC patterns in mind
4. Plan test strategy (what to test, what to mock)

### Step 4: Implement (TDD)
1. **Write tests first** (per TESTING_CONSTITUTION)
2. Implement minimal code to pass tests
3. Run tests and verify they pass
4. Refactor if needed, ensuring tests still pass

### Step 5: Database Changes (If Applicable)
1. Create migration file in `supabase/migrations/`
2. Include RLS policies (per database_security_principles.md)
3. Create views for reads (if needed)
4. Create RPC functions for sensitive writes (if needed)
5. Verify RLS isolation with test users
6. Document deletion/retention strategy

### Step 6: Quality Gate
1. Run `npm run lint` - fix all errors
2. Run tests - all must pass
3. Verify TypeScript types - no `any` without justification
4. Check for security violations (service role, RLS bypass, etc.)

### Step 7: Review
1. Verify compliance with stop conditions
2. Ensure rule precedence was followed
3. Document any deviations with justification

---

## Brand Assets

**Application Logo:**
- **Path:** `app/icon.svg`
- **Usage:** Always use this logo when displaying the ViewBait.app brand in the application
- **Import:** Use Next.js Image component: `<Image src="/icon.svg" alt="ViewBait" />` or import directly: `import Logo from '@/app/icon.svg'`
- **Design:** Orange gradient (FF512F to F09819) with chart/graph iconography
- **Note:** Next.js automatically uses this file as the favicon and app icon. Do not use random logos or create alternative versions without explicit approval.

**When to use:**
- Header/navigation logos
- Loading screens
- Email templates
- Documentation
- Any place where the ViewBait.app brand should appear

---

## Quick Reference

| Task | Consult |
|------|---------|
| Database changes | `docs/database_security_principles.md` |
| API routes / server logic | `agentics/ARCHITECTURE.md` |
| Writing tests | `agentics/TESTING_CONSTITUTION.md` |
| UI components | `agentics/DESIGN_PRINCIPLES.md`, `agentics/mobile_first_principles.md` |
| **Application logo** | **`app/icon.svg`** - Always use this logo, never random alternatives |
| File organization | `agentics/PROJECT_STRUCTURE.md` |
| Product context | `agentics/PROJECT_FACTS.md`, `agentics/VISION.md` |
| Security concerns | `docs/security_principles.md` |
| Performance | `docs/optimization_principles.md` |

---

## Summary

1. **Read PROJECT_FACTS first** - Understand the repo
2. **Security rules override everything** - Database security > Architecture > Testing > Design
3. **Stop on violations** - Redesign rather than compromise
4. **Follow TDD workflow** - Tests before code
5. **Verify quality gate** - Lint, tests, types must pass

**Remember:** These docs are the source of truth. When in doubt, consult the relevant document rather than guessing.
