# PROMPT 02A — TOURKIT LIBRARY CODE

You are creating the TourKit library: helpers, overlay component, tour runner, generator, and doctor script. This prompt creates all the reusable modules WITHOUT touching existing app code. App instrumentation happens in Prompt 02B.

## Pre-flight (required)

Read ALL of these before writing any code:

- `/tourkit/config/routes.json` (must exist from Prompt 01)
- `/tourkit/config/events.json` (must exist from Prompt 01)
- `/tourkit/docs/ANCHOR_EVENT_PLAN.md` (must exist from Prompt 01)
- `/tourkit/docs/NAMING.md` (must exist from Prompt 01)
- `playwright.config.*` (must exist from Prompt 00)
- `package.json`
- `tsconfig.json` (understand module/target settings)

If any Prompt 01 files are missing, STOP and tell the user to run Prompt 01 first.

---

## A) Core helpers

### `/tourkit/app/tourMode.ts`

```ts
/**
 * Tour mode detection.
 * Tour mode is active when URL has ?tour=1 OR env var is set.
 */

export function isTourMode(): boolean {
  if (typeof window === "undefined") return false; // SSR-safe
  const params = new URLSearchParams(window.location.search);
  if (params.get("tour") === "1") return true;
  // Also check env (for server components / build-time)
  if (process.env.NEXT_PUBLIC_TOUR_MODE === "1") return true;
  return false;
}

export function ensureTourParam(url: string): string {
  const u = new URL(url, window.location.origin);
  u.searchParams.set("tour", "1");
  return u.toString();
}
```

### `/tourkit/app/tourEvents.browser.ts`

```ts
/**
 * Emit TourKit custom events.
 * SSR-safe: no-ops when window is not available.
 */

export function emitTourEvent(name: string, detail?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail: detail ?? {} }));
}
```

### `/tourkit/app/tourSelectors.ts`

```ts
/**
 * Anchor utilities for TourKit.
 */

/** Returns CSS selector for a data-tour anchor */
export function anchorSelector(anchor: string): string {
  return `[data-tour="${anchor}"]`;
}

/** Returns a Playwright locator string for a data-tour anchor */
export function anchorLocator(anchor: string): string {
  return `[data-tour="${anchor}"]`;
}
```

---

## B) Tour Overlay component

### `/tourkit/app/TourOverlay.tsx`

Create a React client component that:

1. Only renders when `isTourMode()` returns true AND `process.env.NEXT_PUBLIC_TOUR_OVERLAY !== "0"` (so TOUR_OVERLAY=0 in env disables it even in tour mode)
2. Uses `MutationObserver` to track all elements with `[data-tour]` attributes
3. Draws a visible outline (e.g., 2px dashed blue border) around each anchored element
4. Shows a small floating label with the anchor name near each element
5. Has a toggle button (fixed position, bottom-right) to show/hide the labels
6. Must NOT interfere with click targets or form inputs (use `pointer-events: none` on overlays)
7. Must NOT affect production users (the `isTourMode()` guard ensures this)
8. Must be a client component (`"use client"` directive for Next.js App Router)

**Important**: The overlay is for debugging anchor placement. It should be visually obvious but not block interaction.

---

## C) Tour runner

### `/tourkit/runner/runTour.ts`

This is the core engine that executes a tour JSON file step by step.

**Requirements:**

```ts
import { Page, TestInfo } from "@playwright/test";

interface TourStep {
  type: "say" | "goto" | "click" | "fill" | "expectVisible" | "waitForEvent" | "waitMs" | "snapshot";
  // Fields vary by type, defined in schema
  [key: string]: unknown;
}

interface Tour {
  tourId: string;
  description?: string;
  steps: TourStep[];
}

interface RunOptions {
  artifactDir: string;   // e.g. /tourkit/artifacts/<tourId>/<timestamp>/
  testInfo: TestInfo;     // Playwright TestInfo for video/trace access
}

export async function runTour(page: Page, tour: Tour, opts: RunOptions): Promise<void>;
```

**Step type implementations:**

| Type | Behavior |
|---|---|
| `say` | Log the message to runlog.txt. No UI action. |
| `goto` | Look up `routeKey` in routes config, navigate to that path. Append `?tour=1` if TOUR_MODE is active. |
| `click` | Locate element by `[data-tour="${anchor}"]`, use `safeClick`. |
| `fill` | Locate element by `[data-tour="${anchor}"]`, use `safeFill`. Value comes from `value` (literal) or `valueEnv` (reads `process.env[valueEnv]`). |
| `expectVisible` | Assert the anchor element is visible within timeout. |
| `waitForEvent` | Wait for a custom event by name. Use the event buffer (see below). |
| `waitMs` | `await page.waitForTimeout(ms)`. Use sparingly. |
| `snapshot` | Take screenshot, save to `artifactDir/screens/<stepIndex>_<name>.png`. |

**Critical: Event buffer (MUST implement)**

Events can fire before Playwright attaches a listener. To prevent missed events, install a buffer BEFORE any navigation:

```ts
// Install event buffer at the START of runTour, before any navigation
await page.addInitScript(() => {
  (window as any).__tourkit_events = (window as any).__tourkit_events || [];
  const origDispatch = window.dispatchEvent.bind(window);
  window.dispatchEvent = function (event: Event) {
    if (event.type.startsWith("tour.event.")) {
      (window as any).__tourkit_events.push({
        type: event.type,
        detail: (event as CustomEvent).detail,
        time: Date.now(),
      });
    }
    return origDispatch(event);
  };
});
```

Then `waitForEvent` checks the buffer first:

```ts
async function waitForEvent(page: Page, eventName: string, timeoutMs: number): Promise<void> {
  // Check if event already fired (in the buffer)
  const alreadyFired = await page.evaluate((name) => {
    return ((window as any).__tourkit_events || []).some((e: any) => e.type === name);
  }, eventName);

  if (alreadyFired) return;

  // Otherwise wait for it
  await page.waitForFunction(
    (name) => ((window as any).__tourkit_events || []).some((e: any) => e.type === name),
    eventName,
    { timeout: timeoutMs }
  );
}
```

**Critical: safeClick and safeFill (MUST handle hydration/rerender)**

React/Next.js apps re-render after hydration, which can detach elements between "found" and "clicked". Implement retry logic:

```ts
async function safeClick(page: Page, anchor: string, timeoutMs = 10_000): Promise<void> {
  const selector = `[data-tour="${anchor}"]`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const el = page.locator(selector).first();
      await el.waitFor({ state: "visible", timeout: Math.min(5000, deadline - Date.now()) });
      await el.click({ timeout: 5000 });
      return; // success
    } catch (err: any) {
      if (err.message?.includes("detached") || err.message?.includes("intercept")) {
        // Element was detached by rerender, retry
        await page.waitForTimeout(200);
        continue;
      }
      if (Date.now() >= deadline) throw err;
      await page.waitForTimeout(200);
    }
  }
  throw new Error(`safeClick timed out for anchor: ${anchor} (${timeoutMs}ms)`);
}
```

Implement `safeFill` similarly, using `el.fill(value)` instead of `el.click()`.

**Logging:**

- Before every step, log: step index, step type, anchor/event name, current URL
- Write all logs to `artifactDir/runlog.txt`
- On failure, log the full error with stack trace

**Artifact handling:**

- Screenshots go to `artifactDir/screens/<stepIndex>_<name>.png`
- After the test completes (in the harness, not the runner), copy video and trace from `testInfo.outputDir` into `artifactDir/`
- Create `artifactDir/` at the start of the run if it does not exist

**Fragment support:**

The runner does NOT need to handle fragments. Fragments are resolved by the generator (Prompt 03) before the tour JSON is created. The runner only sees a flat list of steps.

---

## D) Tour schema

### `/tourkit/schema/tour.schema.json`

Create a JSON Schema that validates tour files. Step types:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["tourId", "steps"],
  "properties": {
    "tourId": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
    "description": { "type": "string" },
    "steps": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "type": { "const": "say" },
              "message": { "type": "string" }
            },
            "required": ["type", "message"]
          },
          {
            "type": "object",
            "properties": {
              "type": { "const": "goto" },
              "routeKey": { "type": "string" }
            },
            "required": ["type", "routeKey"]
          },
          {
            "type": "object",
            "properties": {
              "type": { "const": "click" },
              "anchor": { "type": "string", "pattern": "^tour\\." }
            },
            "required": ["type", "anchor"]
          },
          {
            "type": "object",
            "properties": {
              "type": { "const": "fill" },
              "anchor": { "type": "string", "pattern": "^tour\\." },
              "value": { "type": "string" },
              "valueEnv": { "type": "string" }
            },
            "required": ["type", "anchor"]
          },
          {
            "type": "object",
            "properties": {
              "type": { "const": "expectVisible" },
              "anchor": { "type": "string", "pattern": "^tour\\." },
              "timeoutMs": { "type": "number" }
            },
            "required": ["type", "anchor"]
          },
          {
            "type": "object",
            "properties": {
              "type": { "const": "waitForEvent" },
              "name": { "type": "string", "pattern": "^tour\\.event\\." },
              "timeoutMs": { "type": "number" }
            },
            "required": ["type", "name"]
          },
          {
            "type": "object",
            "properties": {
              "type": { "const": "waitMs" },
              "ms": { "type": "number" }
            },
            "required": ["type", "ms"]
          },
          {
            "type": "object",
            "properties": {
              "type": { "const": "snapshot" },
              "name": { "type": "string" }
            },
            "required": ["type", "name"]
          }
        ]
      }
    }
  }
}
```

---

## E) Playwright test harness

### `/tests/e2e/tourkit.spec.ts`

Replace the bootstrap placeholder with the real harness:

```ts
import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { runTour, type Tour } from "../../tourkit/runner/runTour";

const tourFile = process.env.TOUR_FILE;

test.describe("TourKit Tours", () => {

  test.skip(!tourFile, "No TOUR_FILE env var set. Use: cross-env TOUR_FILE=tourkit/tours/<id>.tour.json");

  if (tourFile) {
    const tourPath = path.resolve(process.cwd(), tourFile);
    const tour: Tour = JSON.parse(fs.readFileSync(tourPath, "utf-8"));
    const tourId = tour.tourId;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const artifactDir = path.resolve(process.cwd(), `tourkit/artifacts/${tourId}/${timestamp}`);

    test(`@tourkit @tour:${tourId} — ${tour.description || tourId}`, async ({ page }, testInfo) => {
      fs.mkdirSync(path.join(artifactDir, "screens"), { recursive: true });

      await runTour(page, tour, { artifactDir, testInfo });

      // Copy video if it exists
      const video = page.video();
      if (video) {
        const videoPath = await video.path();
        if (videoPath && fs.existsSync(videoPath)) {
          fs.copyFileSync(videoPath, path.join(artifactDir, "video.webm"));
        }
      }

      // Copy trace if it exists
      // (Playwright saves trace to testInfo.outputDir)
    });
  }
});
```

**Note**: This is a starting point. Adjust imports and paths based on the repo's module resolution.

---

## F) Generator script

### `/tourkit/scripts/generate-tour-from-guide.ts`

This replaces the stub from Prompt 00. Full implementation:

1. Accept a guide file path as CLI argument (e.g., `tsx tourkit/scripts/generate-tour-from-guide.ts tourkit/guides/first-thumbnail.md`)
2. Read the guide file
3. **Resolve fragments**: If a line says `Include fragment: <name>`, read `/tourkit/guides/_fragments/<name>.md` and inline its steps at that position
4. Parse each line into a tour step (see DSL grammar below)
5. **Validate anchors**: Every anchor must exist in `/tourkit/maps/tour.map.json`. If the map does not exist yet, warn but continue (the map is generated in Prompt 02C).
6. **Validate events**: Every event must exist in `/tourkit/config/events.json`
7. **Validate routeKeys**: Every `goto` routeKey must exist in `/tourkit/config/routes.json`
8. On validation failure: print actionable errors with nearest matches (use Levenshtein distance or prefix matching) and exit 1
9. On success: write `/tourkit/tours/<tourId>.tour.json`

**Guide DSL grammar (each line is one step):**

```
Say: <message>
Goto routeKey: <routeKey>
Click <label> (<anchor>)
Fill <label> (<anchor>) value:<literal>
Fill <label> (<anchor>) env:<ENV_VAR_NAME>
Wait for <label> (<event>) timeout:<ms>
Expect visible <label> (<anchor>) timeout:<ms>
Wait <ms>ms
Snapshot <name> name:<filename>
Include fragment: <fragment_name>
# Comment lines (ignored)
```

- `<label>` is human-readable, used for logging/narration only
- `(<anchor>)` or `(<event>)` in parentheses is the machine identifier
- `timeout:` is optional, defaults to 10000
- Lines starting with `#` are comments and are skipped
- Empty lines are skipped
- The `tourId` is inferred from the guide filename (e.g., `first-thumbnail.md` -> `first-thumbnail`)

---

## G) Doctor script

### `/tourkit/scripts/doctor.ts`

This replaces the stub from Prompt 00. Full implementation:

Checks (run all, report all issues, do not stop at first):

1. `/tourkit/config/routes.json` exists and is valid JSON with expected shape
2. `/tourkit/config/events.json` exists and is valid JSON with expected shape  
3. `/tourkit/maps/tour.map.json` exists (if not, warn: "Run `npm run tourkit:map` to generate")
4. `/tourkit/.env.tourkit` exists (if not, warn: "Copy .env.tourkit.example to .env.tourkit")
5. `E2E_EMAIL` and `E2E_PASSWORD` are set in process.env (load dotenv first)
6. Playwright is installed (`npx playwright --version`)
7. All tour JSON files in `/tourkit/tours/` are valid against the schema
8. All anchors referenced in tour files exist in the map (if map exists)

Output format:
```
TourKit Doctor
==============
[PASS] routes.json exists and valid
[PASS] events.json exists and valid
[WARN] tour.map.json missing — run: npm run tourkit:map
[PASS] .env.tourkit exists
[PASS] E2E_EMAIL present
[FAIL] E2E_PASSWORD missing — edit tourkit/.env.tourkit
[PASS] Playwright installed (v1.40.0)

2 passed, 1 warning, 1 failure
```

Exit 0 if all pass (warnings are OK). Exit 1 if any FAIL.

---

## H) Map generator script

### `/tourkit/scripts/generate-tour-map.ts`

This replaces the stub from Prompt 00. Full implementation:

1. Read `/tourkit/config/routes.json` for the list of routes
2. Read `/tourkit/config/events.json` for the canonical event list
3. For each route:
   - Launch a Playwright browser (headless)
   - Navigate to `baseURL + path + ?tour=1`
   - Wait for the page to be loaded (networkidle or domcontentloaded, whichever is appropriate)
   - Collect all unique `data-tour` attribute values on the page
   - Handle auth-gated routes: if a route redirects to login, note it and skip (do not fail)
4. Write `/tourkit/maps/tour.map.json`:
   ```json
   {
     "generatedAt": "2025-02-15T12:00:00Z",
     "routes": {
       "home": { "path": "/", "anchors": ["tour.home.hero.cta.openStudio", "..."] },
       "auth": { "path": "/auth", "anchors": ["tour.auth.form.input.email", "..."] }
     },
     "events": ["tour.event.route.ready", "tour.event.auth.success", "..."]
   }
   ```
5. Write `/tourkit/maps/TOUR_MAP.md` (human-readable version grouped by route then area/type)
6. Print summary: how many routes crawled, how many anchors found, any routes that were skipped

**Note**: This script needs the app running. It uses `webServer` from Playwright config if available, or expects the app to be running already.

---

## Constraints

- Do NOT modify any existing app code in this prompt. That happens in Prompt 02B.
- All new files go under `/tourkit/` (except the test harness under `/tests/e2e/`).
- Match the repo's TypeScript style (check existing code for formatting patterns).
- All scripts must be runnable via `tsx` (already installed in Prompt 00).

---

## Deliverables checklist

- [ ] `/tourkit/app/tourMode.ts`
- [ ] `/tourkit/app/tourEvents.browser.ts`
- [ ] `/tourkit/app/tourSelectors.ts`
- [ ] `/tourkit/app/TourOverlay.tsx`
- [ ] `/tourkit/runner/runTour.ts` (with event buffer, safeClick, safeFill, logging)
- [ ] `/tourkit/schema/tour.schema.json`
- [ ] `/tests/e2e/tourkit.spec.ts` (real harness, replaces bootstrap placeholder)
- [ ] `/tourkit/scripts/generate-tour-from-guide.ts` (full implementation, replaces stub)
- [ ] `/tourkit/scripts/generate-tour-map.ts` (full implementation, replaces stub)
- [ ] `/tourkit/scripts/doctor.ts` (full implementation, replaces stub)

---

## Save this prompt

Save THIS EXACT PROMPT verbatim into:

```
/tourkit/prompts/02A-Library.md
```
