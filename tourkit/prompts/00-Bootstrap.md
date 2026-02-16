# PROMPT 00 — BOOTSTRAP TOURKIT

You are a coding agent working inside this repo. Your job is to bootstrap TourKit so prompts 01 through 04 can run cleanly with zero guessing.

## Primary outcome

Playwright is installed and runnable. The `/tourkit/` folder exists with the correct baseline structure, starter docs, and env wiring. A quick verification proves Playwright can launch a browser. Everything is organized under `/tourkit/`.

## Hard constraints

- Do not delete or overwrite existing tests, scripts, or Playwright config unless necessary.
- If Playwright is already installed, do NOT reinstall; verify version and config.
- Keep all TourKit-related code and docs under `/tourkit/` (except the Playwright test harness which lives under `/tests/e2e/`).
- Use Windows-friendly commands (this repo is developed on Windows).
- If you must modify `package.json` scripts, only ADD missing scripts; never remove or rename existing ones.
- Prefer deterministic, minimal changes.

---

## Step 0 — Repo scan (required before any changes)

Inspect the following and record what you find. Do not skip this step.

1. `package.json`:
   - Is `@playwright/test` already a dependency or devDependency?
   - Is `dotenv` installed?
   - Is `cross-env` installed?
   - Is `tsx` installed? (Required to run `.ts` scripts via `node`-like CLI)
   - List all existing scripts (you will not touch these).

2. Does `playwright.config.*` exist? If so, note: `baseURL`, `testDir`, `use.video`, `use.trace`, and whether it has a `webServer` block.

3. Does a `tests/e2e/` folder exist? What is in it?

4. Is this a Next.js project? What command starts the dev server (`npm run dev`?) and what port does it use? Check `package.json` scripts and any `.env` or `next.config.*` for port configuration.

5. Check `.gitignore` contents (you will append a line if needed).

6. Does `tsconfig.json` exist? Note the `target` and `module` settings (this affects how TourKit scripts should be written).

---

## Step 1 — Install dependencies

Install each of these as devDependencies ONLY if missing:

| Package | Why |
|---|---|
| `@playwright/test` | Test runner for tours |
| `dotenv` | Loads `/tourkit/.env.tourkit` into `process.env` |
| `cross-env` | Windows-safe env assignment in npm scripts |
| `tsx` | Runs `.ts` files directly (required for all TourKit scripts) |

If `@playwright/test` was just installed OR is already present, run:
```
npx playwright install chromium
```
(Install only Chromium to keep it fast. Tours run in one browser.)

If `@playwright/test` was already present, print the installed version (`npm ls @playwright/test`) and continue.

---

## Step 2 — Create TourKit folder skeleton

Create this structure. If a folder already exists, leave it alone. Add `.gitkeep` in any empty directory so Git tracks it.

```
/tourkit/
  /config/
  /docs/
  /maps/
  /schema/
  /guides/
    /_fragments/       <-- shared tour fragments (e.g. login steps)
  /tours/
  /runner/
  /scripts/
  /app/
  /artifacts/
  /prompts/
```

---

## Step 3 — Env wiring (this is critical, do not skip any part)

### A) Create `/tourkit/.env.tourkit.example`

This file MUST always be created (overwrite if it exists, it is the template):

```env
# TourKit environment configuration
# Copy this file to .env.tourkit and fill in real values.

# App URL (must match your dev server)
PLAYWRIGHT_BASE_URL=http://localhost:3000

# Tour behavior
TOUR_MODE=tour_mode
TOUR_OVERLAY=0
TOURKIT_CAPTURE=0

# Auth credentials for tour runs (REQUIRED)
E2E_EMAIL=your_test_email@example.com
E2E_PASSWORD=your_test_password
```

### B) Create `/tourkit/.env.tourkit`

- If this file does NOT exist, copy `.env.tourkit.example` to `.env.tourkit` verbatim.
- If it ALREADY exists, do NOT overwrite it.

### C) Gitignore

Check `.gitignore`. If it does not already contain a line that ignores `/tourkit/.env.tourkit`, append exactly:

```
# TourKit secrets
/tourkit/.env.tourkit
```

Do NOT ignore `.env.tourkit.example` (that is the template and should be committed).

### D) Wire dotenv into Playwright config

This is the key fix: Playwright does NOT automatically load env files. You must load it explicitly.

**If `playwright.config.*` already exists**, make the MINIMAL edits described below. Do NOT rewrite the entire file.

**If no config exists**, create `playwright.config.ts` with the full baseline below.

#### Required additions to the TOP of playwright.config.* (before defineConfig):

```ts
import path from "node:path";
import dotenv from "dotenv";

// Load TourKit env BEFORE Playwright reads config
dotenv.config({ path: path.resolve(process.cwd(), "tourkit/.env.tourkit") });

// Fail fast: tours need auth credentials
const hasEmail = Boolean(process.env.E2E_EMAIL && process.env.E2E_EMAIL !== "your_test_email@example.com");
const hasPassword = Boolean(process.env.E2E_PASSWORD && process.env.E2E_PASSWORD !== "your_test_password");
if (!hasEmail || !hasPassword) {
  console.error("\n╔══════════════════════════════════════════════════════╗");
  console.error("║  TourKit: Missing E2E credentials                    ║");
  console.error("║                                                      ║");
  console.error("║  1. Copy tourkit/.env.tourkit.example                 ║");
  console.error("║     to   tourkit/.env.tourkit                         ║");
  console.error("║  2. Fill in E2E_EMAIL and E2E_PASSWORD                ║");
  console.error("╚══════════════════════════════════════════════════════╝\n");
  console.error(`  E2E_EMAIL present: ${hasEmail}`);
  console.error(`  E2E_PASSWORD present: ${hasPassword}\n`);
  process.exit(1);
}
```

**IMPORTANT**: Do NOT print the actual secret values. Only print boolean presence.

#### Required config settings (add/adjust ONLY if missing, do not break existing settings):

```ts
export default defineConfig({
  testDir: "./tests/e2e",   // leave as-is if already set

  expect: {
    timeout: 10_000,        // leave as-is if already set
  },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",

    // Capture settings: controlled by TOURKIT_CAPTURE env var
    trace:      process.env.TOURKIT_CAPTURE === "1" ? "on" : "on-first-retry",
    video:      process.env.TOURKIT_CAPTURE === "1" ? "on" : "retain-on-failure",
    screenshot: process.env.TOURKIT_CAPTURE === "1" ? "on" : "only-on-failure",
  },

  // Auto-start the dev server for tour runs
  // This eliminates the "app not running" failure mode entirely
  webServer: {
    command: "npm run dev",    // adjust if the app uses a different start command
    port: 3000,                // adjust if the app uses a different port
    reuseExistingServer: true, // don't fail if server is already running
    timeout: 120_000,          // 2 min for cold starts (Next.js can be slow)
  },
});
```

**Critical**: Discover the correct `command` and `port` from Step 0. If the app uses `npm run dev` on port 3000, use those. If it uses something else, use what you found. Do NOT guess.

---

## Step 4 — Add npm scripts

Add ONLY if missing. Never delete or rename existing scripts.

```json
{
  "tourkit:doctor":  "tsx tourkit/scripts/doctor.ts",
  "tourkit:map":     "tsx tourkit/scripts/generate-tour-map.ts",
  "tourkit:gen":     "tsx tourkit/scripts/generate-tour-from-guide.ts",
  "tour:all":        "playwright test tests/e2e/tourkit.spec.ts --grep @tourkit",
  "pw:ui":           "playwright test --ui"
}
```

**Note**: All scripts use `tsx` (not `node`) because TourKit scripts are TypeScript.

---

## Step 5 — Create stub scripts

Create minimal stubs so the npm commands don't fail before Prompts 02A/03 implement them. Match the repo's TypeScript conventions.

### `/tourkit/scripts/doctor.ts`
```ts
console.log("TourKit Doctor not implemented yet. Run Prompt 02A.");
process.exit(0);
```

### `/tourkit/scripts/generate-tour-map.ts`
```ts
console.log("Map generator not implemented yet. Run Prompt 02A.");
process.exit(0);
```

### `/tourkit/scripts/generate-tour-from-guide.ts`
```ts
console.log("Tour generator not implemented yet. Run Prompt 03.");
process.exit(0);
```

---

## Step 6 — Create Playwright harness placeholder

If `/tests/e2e/` does not exist, create it.

Create `/tests/e2e/tourkit.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("@tourkit bootstrap: app loads and env is present", async ({ page }) => {
  // Verify app is reachable
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();

  // Verify TourKit env is loaded (boolean presence only)
  expect(
    process.env.E2E_EMAIL,
    "E2E_EMAIL is missing. Fill tourkit/.env.tourkit"
  ).toBeTruthy();
  expect(
    process.env.E2E_PASSWORD,
    "E2E_PASSWORD is missing. Fill tourkit/.env.tourkit"
  ).toBeTruthy();
});
```

---

## Step 7 — Create baseline docs

### `/tourkit/docs/PURPOSE.md`

Write a one-page doc covering:
- What TourKit is: a Playwright-based system for creating repeatable, guided tours of a web app
- What problems it solves: brittle text selectors, missed async events, unorganized test artifacts
- The contract: tours reference only `data-tour` attributes and `tour.event.*` custom events
- The prompt sequence: 00 (bootstrap) -> 01 (discovery) -> 02A/B/C (library, instrument, map) -> 03 (create tours, repeatable) -> 04 (documentation)
- Multi-tour architecture: each feature gets its own tour, shared flows (like login) use fragments

### `/tourkit/docs/BOOTSTRAP.md`

Write a doc covering:
- What Prompt 00 set up
- Dependencies installed (Playwright, dotenv, cross-env, tsx)
- Env wiring: where secrets live (`/tourkit/.env.tourkit`), what is gitignored, how Playwright loads it via dotenv in the config
- The `webServer` block in Playwright config (auto-starts dev server)
- Capture/overlay toggles:
  - `TOURKIT_CAPTURE=1` forces video/screenshot/trace on every run
  - `TOUR_OVERLAY=1` enables visual anchor overlay in the app (once implemented)
- Which scripts exist and what they do
- Verification instructions:
  1. Fill `/tourkit/.env.tourkit` with real credentials
  2. Run: `npx playwright test --grep @tourkit`
  3. Confirm it opens the app and passes
- Exact next step: run Prompt 01

---

## Step 8 — Verification

Run this command to confirm Playwright works:

```
npx playwright test --grep @tourkit
```

(Do NOT use `--headed` in the agent environment; just confirm it runs and passes.)

If it fails:
- Read the error output carefully
- If it is an env var issue, fix the `.env.tourkit` file
- If it is a connection issue, check the `webServer` block in `playwright.config.ts`
- If it is a missing browser, run `npx playwright install chromium`
- Fix and rerun until it passes

---

## Step 9 — Save this prompt

Save THIS EXACT PROMPT verbatim into:

```
/tourkit/prompts/00-Bootstrap.md
```

Create the folder if it does not exist. Do not paraphrase. Save verbatim.

---

## Deliverables checklist (all must exist when done)

- [ ] `/tourkit/` folder structure (including `/tourkit/guides/_fragments/` and `/tourkit/prompts/`)
- [ ] `/tourkit/docs/PURPOSE.md`
- [ ] `/tourkit/docs/BOOTSTRAP.md`
- [ ] `/tourkit/.env.tourkit.example`
- [ ] `/tourkit/.env.tourkit` (created from example if missing)
- [ ] `.gitignore` ignores `/tourkit/.env.tourkit`
- [ ] `playwright.config.*` loads dotenv, fails fast on missing creds, has `webServer` block, has capture settings
- [ ] `package.json` has all TourKit scripts (using `tsx`, not `node`)
- [ ] `tsx` installed as devDependency
- [ ] Playwright installed + Chromium browser installed
- [ ] `/tests/e2e/tourkit.spec.ts` placeholder passes
- [ ] `/tourkit/prompts/00-Bootstrap.md` contains this prompt verbatim
