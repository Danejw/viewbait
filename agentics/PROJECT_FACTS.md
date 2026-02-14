# PROJECT_FACTS.md

**Last verified:** 2026-01-27  
**Source:** Repo scan + user-provided facts

---

## Product Facts

### Product Identity
- **Product name:** ViewBait.app
- **Short description:** ViewBait.app generates AI-powered visual concepts and thumbnails intended to improve click performance on social platforms.
- **Long description:** ViewBait.app is an AI tool focused on creating and iterating visual assets like thumbnails and image concepts for content distribution. It is designed to help users quickly generate visual options rather than manually designing each asset. The product centers on speed, experimentation, and visual output.

### Product Basics
- **Primary user type(s):** YouTube creators or filmmakers who need cover art or thumbnails for their content.
- **Primary value metric(s):** Generating visual assets (thumbnails / image concepts). No confirmed performance tracking or optimization metric is implemented yet.

### Support and Trust
- **Support email (in-app):** yourindie101@gmail.com
- **Public contact email:** yourindie101@gmail.com
- **Legal/terms contact email:** yourindie101@gmail.com
- **Support UX:** Not explicitly decided yet (form, mailto, or both).

### Branding
- **Brand voice:** Chill but very creative vibe.
- **Hard don'ts:**
  - Never use em-dashes
  - Don't sound like a robot, always sound human and relatable

### Brand Assets
- **Application logo:** `app/icon.svg`
  - Path: `app/icon.svg` (Next.js automatically uses this as the favicon and app icon)
  - Usage: Reference this file when the logo is needed in components or documentation
  - Design: Orange gradient (FF512F to F09819) with chart/graph iconography
  - Import example: `import Logo from '@/app/icon.svg'` or use Next.js Image component with `/icon.svg`

---

## Technical Facts

### Stack
- **Primary stack:** Next.js 16.1.6 (App Router)
- **Framework:** React 19.2.3
- **UI library:** shadcn/ui components
- **Styling:** Tailwind CSS 4
- **TypeScript:** Strict mode enabled

### Server Surface
- **Default server surface:** Next.js route handlers (none implemented yet)
- **DB:** Not configured yet (Supabase skills present but no client implementation found)
- **Auth:** Not implemented yet

### Tenancy
- **Default tenancy:** Not confirmed (no evidence of multi-tenant patterns or org tables found)
- **Evidence:** No database schema, migrations, or tenancy patterns detected in codebase

### Commands
- **Lint:** `npm run lint` (ESLint with Next.js config)
- **Test:** `npm test` / `npm run test:run`
- **Build:** `npm run build`
- **Dev:** `npm run dev`
- **Start:** `npm start`
- **Performance/network score:** `npm run score` (app must be running). Prints 0–100 Lighthouse performance score; see [docs/audits/performance-score.md](../docs/audits/performance-score.md). Variants: `npm run score:landing`, `npm run score:studio`.

### Migration Workflow
- Not implemented (no Supabase migrations or database setup found)

### Observability
- Not configured

### Deployment Targets
- Vercel (mentioned in README, no explicit config found)

---

## Evidence

Technical facts derived from:
- `viewbait/package.json` - dependencies, scripts
- `viewbait/next.config.ts` - Next.js configuration
- `viewbait/tsconfig.json` - TypeScript strict mode
- `viewbait/eslint.config.mjs` - ESLint setup
- `viewbait/app/` - App Router structure
- `viewbait/components/` - shadcn/ui components
- `viewbait/README.md` - deployment mention
- No Supabase client code found in `lib/` or `app/`
- No API routes found in `app/api/`
- No test files or test configuration found

---

## Update Policy

This file must be updated whenever new facts are revealed during development or conversation, including:
- Product name/description changes
- Contact email updates
- Tenancy model changes (single-tenant → multi-tenant or vice versa)
- Stack changes (new frameworks, new services)
- Command changes (new scripts, new tooling)
- New system facts (new services, new frameworks, new auth flows, new observability tools)

When implementing features that introduce new system facts (new services, new frameworks, new auth flows, new observability tools), the agent must append or revise the relevant fields here as part of the same change.

Keep entries factual; do not add opinions.
