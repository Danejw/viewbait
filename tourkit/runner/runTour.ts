// tourkit/runner/runTour.ts
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { ensureTourParam, isTourModeActive } from "@/tourkit/app/tourMode";
import { anchorLocator } from "@/tourkit/app/tourSelectors";

type TourStep =
  | { type: "say"; text?: string; message?: string }
  | { type: "goto"; routeKey: string; timeoutMs?: number }
  | { type: "click"; anchor: string; timeoutMs?: number }
  | { type: "fill"; anchor: string; value?: string; valueEnv?: string; timeoutMs?: number }
  | { type: "expectVisible"; anchor: string; timeoutMs?: number }
  | { type: "waitForEvent"; name: string; timeoutMs?: number }
  | { type: "waitMs"; durationMs?: number; ms?: number }
  | { type: "snapshot"; name: string };

export type Tour = {
  // support both schemas
  id?: string;
  tourId?: string;
  title?: string;
  description?: string;
  steps: TourStep[];
};

type TourMap = {
  routes: Record<string, { path: string; anchors: string[] }>;
  events: string[];
};

export type RunTourOptions = {
  artifactDir: string;
  testInfo: TestInfo;
};

const ACTION_TIMEOUT_MS = 30_000;
const GOTO_TIMEOUT_MS_DEFAULT = 45_000;
const RETRY_POLL_MS = 150;

function nowIsoCompact(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function loadTourMap(): TourMap {
  const mapPath = resolve(process.cwd(), "tourkit/maps/tour.map.json");
  return JSON.parse(readFileSync(mapPath, "utf8")) as TourMap;
}

function findFileRecursive(root: string, filename: string): string | null {
  const entries = readdirSync(root);
  for (const entry of entries) {
    const full = join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      const nested = findFileRecursive(full, filename);
      if (nested) return nested;
    } else if (entry === filename) {
      return full;
    }
  }
  return null;
}

function isDetachedishError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return (
    msg.includes("Element is not attached to the DOM") ||
    msg.includes("not attached") ||
    msg.includes("has been detached") ||
    msg.includes("Target closed") ||
    msg.includes("Execution context was destroyed") ||
    msg.includes("Cannot find context") ||
    msg.includes("because the page has navigated")
  );
}

function isGotoRetryable(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return (
    msg.includes("net::ERR_ABORTED") ||
    msg.includes("frame was detached") ||
    msg.includes("Execution context was destroyed") ||
    msg.includes("Target closed") ||
    msg.includes("because the page has navigated") ||
    msg.includes("page.goto: Timeout") // treat goto timeouts as retryable too
  );
}

function locatorForAnchor(page: Page, anchor: string) {
  return page.locator(anchorLocator(anchor)).first();
}

/**
 * Install a browser-side event buffer so waits never miss fast events.
 * Runs before any navigation and persists across reloads.
 */
async function installTourEventBuffer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as any;
    if (w.__tourkit?.installed) return;

    w.__tourkit = w.__tourkit ?? {};
    w.__tourkit.installed = true;
    w.__tourkit.events = w.__tourkit.events ?? [];

    const origDispatch = window.dispatchEvent.bind(window);

    window.dispatchEvent = (event: Event) => {
      try {
        const ev: any = event as any;
        const name = String(ev?.type ?? "");
        if (name.startsWith("tour.event.")) {
          w.__tourkit.events.push({
            name,
            detail: ev?.detail ?? null,
            ts: Date.now(),
          });

          // cap buffer
          if (w.__tourkit.events.length > 500) {
            w.__tourkit.events.splice(0, w.__tourkit.events.length - 500);
          }
        }
      } catch {
        // ignore
      }
      return origDispatch(event);
    };
  });
}

async function waitForTourEvent(
  page: Page,
  eventName: string,
  timeoutMs = ACTION_TIMEOUT_MS
): Promise<unknown> {
  const existing = await page.evaluate((name) => {
    const w = window as any;
    const evs: any[] = w.__tourkit?.events ?? [];
    for (let i = evs.length - 1; i >= 0; i--) {
      if (evs[i]?.name === name) return evs[i]?.detail ?? null;
    }
    return "__TOURKIT_NOT_FOUND__";
  }, eventName);

  if (existing !== "__TOURKIT_NOT_FOUND__") return existing;

  await page.waitForFunction(
    (name) => {
      const w = window as any;
      const evs: any[] = w.__tourkit?.events ?? [];
      return evs.some((e) => e?.name === name);
    },
    eventName,
    { timeout: timeoutMs }
  );

  return await page.evaluate((name) => {
    const w = window as any;
    const evs: any[] = w.__tourkit?.events ?? [];
    for (let i = evs.length - 1; i >= 0; i--) {
      if (evs[i]?.name === name) return evs[i]?.detail ?? null;
    }
    return null;
  }, eventName);
}

/**
 * Robust goto for SPAs:
 * - use domcontentloaded (more reliable for Next.js + redirects than commit)
 * - retry on abort/detach/timeouts
 */
async function safeGoto(page: Page, url: string, timeoutMs = 120_000): Promise<void> {
  // Preflight: if the server isn't responding, fail with a useful message immediately.
  try {
    const resp = await page.request.get(url, { timeout: 15_000 });
    if (!resp.ok()) {
      throw new Error(`HTTP ${resp.status()} ${resp.statusText()}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `TourKit could not reach the app at ${url}.\n` +
      `Fix: start the app (or let Playwright webServer finish booting), then retry.\n` +
      `Details: ${msg}`
    );
  }

  // Navigation: give Next enough time on cold boot.
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
}

async function safeClick(page: Page, anchor: string, timeoutMs = ACTION_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const loc = locatorForAnchor(page, anchor);

    try {
      await loc.waitFor({ state: "visible", timeout: Math.min(2_500, Math.max(250, deadline - Date.now())) });
      await loc.click({ trial: true, timeout: 2_500 });
      await loc.click({ timeout: 10_000 });
      return;
    } catch (err) {
      if (Date.now() > deadline) throw err;

      const msg = String((err as any)?.message ?? err ?? "");
      if (isDetachedishError(err)) {
        await page.waitForTimeout(RETRY_POLL_MS);
        continue;
      }
      if (
        msg.includes("Element is not visible") ||
        msg.includes("intercepts pointer events") ||
        msg.includes("waiting for element to be visible") ||
        msg.includes("Timeout") ||
        msg.includes("strict mode violation")
      ) {
        await page.waitForTimeout(RETRY_POLL_MS);
        continue;
      }

      throw err;
    }
  }
}

async function safeFill(page: Page, anchor: string, value: string, timeoutMs = ACTION_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const loc = locatorForAnchor(page, anchor);

    try {
      await loc.waitFor({ state: "visible", timeout: Math.min(2_500, Math.max(250, deadline - Date.now())) });
      await loc.fill(value, { timeout: 10_000 });
      return;
    } catch (err) {
      if (Date.now() > deadline) throw err;

      const msg = String((err as any)?.message ?? err ?? "");
      if (isDetachedishError(err)) {
        await page.waitForTimeout(RETRY_POLL_MS);
        continue;
      }
      if (msg.includes("Element is not visible") || msg.includes("Timeout") || msg.includes("waiting for")) {
        await page.waitForTimeout(RETRY_POLL_MS);
        continue;
      }

      throw err;
    }
  }
}

async function bestEffortStabilize(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: 3_000 });
  } catch {
    // ignore
  }
  await page.waitForTimeout(50);
}

function resolveTourId(tour: Tour): string {
  return tour.id ?? tour.tourId ?? "unknown-tour";
}

export async function runTour(page: Page, tour: Tour, options: RunTourOptions): Promise<void> {
  const map = loadTourMap();
  const logs: string[] = [];
  const startedAt = nowIsoCompact();

  mkdirSync(options.artifactDir, { recursive: true });
  const screensDir = join(options.artifactDir, "screens");
  mkdirSync(screensDir, { recursive: true });

  const log = (message: string) => {
    const line = `[${new Date().toISOString()}] ${message}`;
    logs.push(line);
    console.log(`[tourkit:run] ${message}`);
  };

  await installTourEventBuffer(page);

  const tourId = resolveTourId(tour);
  log(`tour=${tourId} stepCount=${tour.steps.length} started=${startedAt}`);

  for (let i = 0; i < tour.steps.length; i += 1) {
    const step = tour.steps[i];
    const stepNumber = i + 1;

    log(`step ${stepNumber}/${tour.steps.length}: ${step.type}`);

    switch (step.type) {
      case "say": {
        const text = step.text ?? step.message ?? "";
        log(`say: ${text}`);
        break;
      }

      case "goto": {
        const route = map.routes[step.routeKey];
        if (!route) throw new Error(`Unknown routeKey '${step.routeKey}' in step ${stepNumber}`);

        const base =
          process.env.PLAYWRIGHT_BASE_URL ??
          process.env.NEXT_PUBLIC_APP_URL ??
          "http://localhost:3000";

        const absolute = new URL(route.path, base).toString();
        const url = isTourModeActive() ? ensureTourParam(absolute) : absolute;

        log(`goto: ${step.routeKey} => ${url}`);

        await safeGoto(page, url, step.timeoutMs ?? GOTO_TIMEOUT_MS_DEFAULT);
        await bestEffortStabilize(page);
        break;
      }

      case "click": {
        await safeClick(page, step.anchor, step.timeoutMs ?? ACTION_TIMEOUT_MS);
        break;
      }

      case "fill": {
        const value = step.valueEnv ? process.env[step.valueEnv] : step.value;
        if (!value) throw new Error(`Missing fill value for '${step.anchor}' (value/valueEnv)`);
        await safeFill(page, step.anchor, value, step.timeoutMs ?? ACTION_TIMEOUT_MS);
        break;
      }

      case "expectVisible": {
        await locatorForAnchor(page, step.anchor).waitFor({
          state: "visible",
          timeout: step.timeoutMs ?? ACTION_TIMEOUT_MS,
        });
        break;
      }

      case "waitForEvent": {
        const detail = await waitForTourEvent(page, step.name, step.timeoutMs ?? ACTION_TIMEOUT_MS);
        log(`event: ${step.name} detail=${JSON.stringify(detail)}`);
        break;
      }

      case "waitMs": {
        const ms = step.durationMs ?? step.ms ?? 0;
        await page.waitForTimeout(ms);
        break;
      }

      case "snapshot": {
        const fileName = `${String(stepNumber).padStart(3, "0")}_${step.name}.png`;
        const destination = join(screensDir, fileName);
        await page.screenshot({ path: destination, fullPage: true });
        log(`snapshot: ${destination}`);
        break;
      }

      default: {
        const exhaustive: never = step;
        throw new Error(`Unhandled step ${(exhaustive as { type?: string }).type ?? "unknown"}`);
      }
    }
  }

  const videoPath = findFileRecursive(options.testInfo.outputDir, "video.webm");
  if (videoPath) {
    copyFileSync(videoPath, join(options.artifactDir, "video.webm"));
    log("copied video.webm");
  }

  const tracePath = findFileRecursive(options.testInfo.outputDir, "trace.zip");
  if (tracePath) {
    copyFileSync(tracePath, join(options.artifactDir, "trace.zip"));
    log("copied trace.zip");
  }

  writeFileSync(join(options.artifactDir, "runlog.txt"), `${logs.join("\n")}\n`, "utf8");
}

export function inferTourIdFromFile(path: string): string {
  const file = basename(path);
  if (file.endsWith(".tour.json")) return file.slice(0, -".tour.json".length);
  return file.replace(extname(file), "");
}
