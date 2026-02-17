import fs from "node:fs";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

type StepType =
  | "say"
  | "goto"
  | "click"
  | "fill"
  | "expectVisible"
  | "waitForEvent"
  | "waitMs"
  | "snapshot";

export interface TourStep {
  type: StepType;
  [key: string]: unknown;
}

export interface Tour {
  tourId: string;
  description?: string;
  steps: TourStep[];
}

interface RouteEntry {
  routeKey: string;
  path: string;
}

interface RoutesConfig {
  routes: RouteEntry[];
}

interface RunOptions {
  artifactDir: string;
  testInfo: TestInfo;
}

function anchorSelector(anchor: string): string {
  return `[data-tour="${anchor}"]`;
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function isTourModeActive(): boolean {
  return process.env.TOUR_MODE === "tour_mode" || process.env.TOUR_MODE === "1";
}

function ensureTourParam(target: string): string {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const url = new URL(target, base);
  url.searchParams.set("tour", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

function readRoutes(): Map<string, string> {
  const routesPath = path.resolve(process.cwd(), "tourkit/config/routes.json");
  const raw = fs.readFileSync(routesPath, "utf8");
  const parsed = JSON.parse(raw) as RoutesConfig;

  const routeMap = new Map<string, string>();
  for (const route of parsed.routes) {
    routeMap.set(route.routeKey, route.path);
  }

  return routeMap;
}

function appendRunLog(file: string, line: string): void {
  fs.appendFileSync(file, `${line}\n`, "utf8");
}

async function safeClick(page: Page, anchor: string, timeoutMs = 10_000): Promise<void> {
  const selector = anchorSelector(anchor);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: Math.min(5_000, deadline - Date.now()) });
      await locator.click({ timeout: Math.min(5_000, deadline - Date.now()) });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        message.includes("detached") ||
        message.includes("intercept") ||
        message.includes("not attached") ||
        message.includes("Element is not attached");

      if (!retryable && Date.now() >= deadline) throw error;
      await page.waitForTimeout(200);
    }
  }

  throw new Error(`safeClick timed out for anchor: ${anchor} (${timeoutMs}ms)`);
}

async function safeFill(page: Page, anchor: string, value: string, timeoutMs = 10_000): Promise<void> {
  const selector = anchorSelector(anchor);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: Math.min(5_000, deadline - Date.now()) });
      await locator.fill(value, { timeout: Math.min(5_000, deadline - Date.now()) });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        message.includes("detached") ||
        message.includes("intercept") ||
        message.includes("not attached") ||
        message.includes("Element is not attached");

      if (!retryable && Date.now() >= deadline) throw error;
      await page.waitForTimeout(200);
    }
  }

  throw new Error(`safeFill timed out for anchor: ${anchor} (${timeoutMs}ms)`);
}

async function waitForTourEvent(page: Page, eventName: string, timeoutMs: number): Promise<void> {
  const alreadyFired = await page.evaluate((name) => {
    const events = (window as unknown as { __tourkit_events?: Array<{ type: string }> }).__tourkit_events ?? [];
    return events.some((event) => event.type === name);
  }, eventName);

  if (alreadyFired) return;

  await page.waitForFunction(
    (name) => {
      const events = (window as unknown as { __tourkit_events?: Array<{ type: string }> }).__tourkit_events ?? [];
      return events.some((event) => event.type === name);
    },
    eventName,
    { timeout: timeoutMs }
  );
}

async function runStep(
  page: Page,
  step: TourStep,
  stepIndex: number,
  routeMap: Map<string, string>,
  logFile: string,
  screensDir: string
): Promise<void> {
  const type = step.type;
  const currentUrl = page.url();

  const contextKey =
    typeof step.anchor === "string"
      ? step.anchor
      : typeof step.name === "string"
        ? step.name
        : typeof step.routeKey === "string"
          ? step.routeKey
          : "";

  appendRunLog(logFile, `[STEP ${stepIndex}] type=${type} key=${contextKey} url=${currentUrl}`);

  if (type === "say") {
    appendRunLog(logFile, `  say: ${String(step.message ?? "")}`);
    return;
  }

  if (type === "goto") {
    const routeKey = String(step.routeKey ?? "");
    const targetPath = routeMap.get(routeKey);
    if (!targetPath) throw new Error(`Unknown routeKey in goto step: ${routeKey}`);

    const finalPath = isTourModeActive() ? ensureTourParam(targetPath) : targetPath;
    await page.goto(finalPath, { waitUntil: "domcontentloaded" });
    return;
  }

  if (type === "click") {
    const anchor = String(step.anchor ?? "");
    await safeClick(page, anchor, Number(step.timeoutMs ?? 10_000));
    return;
  }

  if (type === "fill") {
    const anchor = String(step.anchor ?? "");
    const valueEnv = typeof step.valueEnv === "string" ? step.valueEnv : undefined;
    const literalValue = typeof step.value === "string" ? step.value : undefined;

    const value = valueEnv ? process.env[valueEnv] : literalValue;
    if (value == null) {
      throw new Error(`Fill step missing value. anchor=${anchor} valueEnv=${valueEnv ?? "<none>"}`);
    }

    await safeFill(page, anchor, value, Number(step.timeoutMs ?? 10_000));
    return;
  }

  if (type === "expectVisible") {
    const anchor = String(step.anchor ?? "");
    const timeoutMs = Number(step.timeoutMs ?? 10_000);
    await expect(page.locator(anchorSelector(anchor)).first()).toBeVisible({ timeout: timeoutMs });
    return;
  }

  if (type === "waitForEvent") {
    const name = String(step.name ?? "");
    const timeoutMs = Number(step.timeoutMs ?? 10_000);
    await waitForTourEvent(page, name, timeoutMs);
    return;
  }

  if (type === "waitMs") {
    const ms = Number(step.ms ?? 0);
    await page.waitForTimeout(ms);
    return;
  }

  if (type === "snapshot") {
    const name = sanitizeFileName(String(step.name ?? `step-${stepIndex}`));
    const file = path.join(screensDir, `${String(stepIndex).padStart(3, "0")}_${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    appendRunLog(logFile, `  snapshot: ${file}`);
    return;
  }

  throw new Error(`Unsupported step type: ${String(type)}`);
}

export async function runTour(page: Page, tour: Tour, opts: RunOptions): Promise<void> {
  const { artifactDir } = opts;
  fs.mkdirSync(artifactDir, { recursive: true });
  const screensDir = path.join(artifactDir, "screens");
  fs.mkdirSync(screensDir, { recursive: true });
  const logFile = path.join(artifactDir, "runlog.txt");

  appendRunLog(logFile, `Tour ${tour.tourId} started at ${new Date().toISOString()}`);

  await page.addInitScript(() => {
    (window as unknown as { __tourkit_events?: Array<{ type: string; detail: unknown; time: number }> }).__tourkit_events =
      (window as unknown as { __tourkit_events?: Array<{ type: string; detail: unknown; time: number }> }).__tourkit_events ?? [];

    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = function patchedDispatch(event: Event): boolean {
      if (event.type.startsWith("tour.event.")) {
        const custom = event as CustomEvent;
        const store = (window as unknown as { __tourkit_events: Array<{ type: string; detail: unknown; time: number }> })
          .__tourkit_events;
        store.push({
          type: event.type,
          detail: custom.detail,
          time: Date.now(),
        });
      }

      return originalDispatch(event);
    };
  });

  const routeMap = readRoutes();

  try {
    for (let index = 0; index < tour.steps.length; index += 1) {
      await runStep(page, tour.steps[index], index, routeMap, logFile, screensDir);
    }

    appendRunLog(logFile, `Tour ${tour.tourId} completed at ${new Date().toISOString()}`);
  } catch (error) {
    const stack = error instanceof Error ? error.stack ?? error.message : String(error);
    appendRunLog(logFile, `[ERROR] ${stack}`);
    throw error;
  }
}
