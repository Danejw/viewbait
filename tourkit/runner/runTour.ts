import fs from "node:fs";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

type StepType =
  | "say"
  | "narration"
  | "goto"
  | "click"
  | "fill"
  | "expectVisible"
  | "waitForEvent"
  | "waitMs"
  | "snapshot"
  | "screenshot"
  | "annotate";

interface StepCapture {
  when: "before" | "after";
  name: string;
  fullPage?: boolean;
}

interface StepAnnotate {
  targetScreenshot?: string;
  instructions: string;
  style?: string;
  notes?: string;
}

export interface TourStep {
  type: StepType;
  label?: string;
  anchor?: string;
  routeKey?: string;
  name?: string;
  message?: string;
  value?: string;
  valueEnv?: string;
  timeoutMs?: number;
  ms?: number;
  durationMs?: number;
  fullPage?: boolean;
  targetScreenshot?: string;
  instructions?: string;
  preDelayMs?: number;
  narration?: string;
  capture?: StepCapture;
  annotate?: StepAnnotate;
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

type AnnotationJob = {
  tourId: string;
  stepIndex: number;
  label: string;
  screenshotPath: string;
  instructions: string;
  style?: string;
  notes?: string;
};

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
  fs.appendFileSync(file, `${new Date().toISOString()} ${line}\n`, "utf8");
}

function appendAnnotationJob(file: string, job: AnnotationJob): void {
  fs.appendFileSync(file, `${JSON.stringify(job)}\n`, "utf8");
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

async function captureScreenshot(
  page: Page,
  screensDir: string,
  stepIndex: number,
  name: string,
  fullPage = true,
  logFile?: string
): Promise<string> {
  const safeName = sanitizeFileName(name || `step-${stepIndex}`);
  const file = path.join(screensDir, `${String(stepIndex).padStart(3, "0")}_${safeName}.png`);
  await page.screenshot({ path: file, fullPage });
  if (logFile) appendRunLog(logFile, `  screenshot: ${file}`);
  return file;
}

function resolveAnnotateTarget(
  annotate: StepAnnotate,
  screenshotsByName: Map<string, string>,
  lastScreenshotPath?: string
): string {
  if (annotate.targetScreenshot) {
    return screenshotsByName.get(annotate.targetScreenshot) ?? annotate.targetScreenshot;
  }
  return lastScreenshotPath ?? "";
}

async function runStep(
  page: Page,
  step: TourStep,
  stepIndex: number,
  routeMap: Map<string, string>,
  logFile: string,
  screensDir: string,
  tourId: string,
  annotationsFile: string,
  screenshotsByName: Map<string, string>,
  lastScreenshotPath: string | undefined
): Promise<string | undefined> {
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

  if (typeof step.preDelayMs === "number" && step.preDelayMs > 0) {
    appendRunLog(logFile, `  preDelayMs: ${step.preDelayMs}`);
    await page.waitForTimeout(step.preDelayMs);
  }

  if (step.narration) {
    appendRunLog(logFile, `  narration: ${step.narration}`);
  }

  const runCapture = async (when: "before" | "after"): Promise<string | undefined> => {
    if (!step.capture || step.capture.when !== when) return undefined;
    const shotPath = await captureScreenshot(
      page,
      screensDir,
      stepIndex,
      step.capture.name,
      step.capture.fullPage ?? true,
      logFile
    );
    screenshotsByName.set(step.capture.name, shotPath);
    return shotPath;
  };

  let mostRecent = lastScreenshotPath;

  const beforeShot = await runCapture("before");
  if (beforeShot) mostRecent = beforeShot;

  if (type === "say" || type === "narration") {
    appendRunLog(logFile, `  narrationStep: ${String(step.message ?? "")}`);
  } else if (type === "goto") {
    const routeKey = String(step.routeKey ?? "");
    const targetPath = routeMap.get(routeKey);
    if (!targetPath) throw new Error(`Unknown routeKey in goto step: ${routeKey}`);
    const finalPath = isTourModeActive() ? ensureTourParam(targetPath) : targetPath;
    await page.goto(finalPath, { waitUntil: "domcontentloaded" });
  } else if (type === "click") {
    await safeClick(page, String(step.anchor ?? ""), Number(step.timeoutMs ?? 10_000));
  } else if (type === "fill") {
    const anchor = String(step.anchor ?? "");
    const valueEnv = typeof step.valueEnv === "string" ? step.valueEnv : undefined;
    const literalValue = typeof step.value === "string" ? step.value : undefined;
    const value = valueEnv ? process.env[valueEnv] : literalValue;
    if (value == null) throw new Error(`Fill step missing value. anchor=${anchor} valueEnv=${valueEnv ?? "<none>"}`);
    await safeFill(page, anchor, value, Number(step.timeoutMs ?? 10_000));
  } else if (type === "expectVisible") {
    await expect(page.locator(anchorSelector(String(step.anchor ?? ""))).first()).toBeVisible({
      timeout: Number(step.timeoutMs ?? 10_000),
    });
  } else if (type === "waitForEvent") {
    await waitForTourEvent(page, String(step.name ?? ""), Number(step.timeoutMs ?? 10_000));
  } else if (type === "waitMs") {
    const duration = Number(step.durationMs ?? step.ms ?? 0);
    await page.waitForTimeout(duration);
  } else if (type === "snapshot" || type === "screenshot") {
    const shotName = String(step.name ?? `step-${stepIndex}`);
    const shotPath = await captureScreenshot(
      page,
      screensDir,
      stepIndex,
      shotName,
      step.fullPage ?? true,
      logFile
    );
    screenshotsByName.set(shotName, shotPath);
    mostRecent = shotPath;
  } else if (type === "annotate") {
    const instructions = String(step.instructions ?? "").trim();
    if (!instructions) throw new Error(`Annotate step missing instructions at step ${stepIndex}`);
    const targetPath = step.targetScreenshot
      ? screenshotsByName.get(String(step.targetScreenshot)) ?? String(step.targetScreenshot)
      : mostRecent ?? "";

    appendAnnotationJob(annotationsFile, {
      tourId,
      stepIndex,
      label: String(step.label ?? step.name ?? `step-${stepIndex}`),
      screenshotPath: targetPath,
      instructions,
      ...(typeof step.style === "string" ? { style: step.style } : {}),
      ...(typeof step.notes === "string" ? { notes: step.notes } : {}),
    });
  } else {
    throw new Error(`Unsupported step type: ${String(type)}`);
  }

  const afterShot = await runCapture("after");
  if (afterShot) mostRecent = afterShot;

  if (step.annotate?.instructions) {
    const target = resolveAnnotateTarget(step.annotate, screenshotsByName, mostRecent);
    appendAnnotationJob(annotationsFile, {
      tourId,
      stepIndex,
      label: String(step.label ?? step.name ?? `step-${stepIndex}`),
      screenshotPath: target,
      instructions: step.annotate.instructions,
      ...(step.annotate.style ? { style: step.annotate.style } : {}),
      ...(step.annotate.notes ? { notes: step.annotate.notes } : {}),
    });
  }

  return mostRecent;
}

export async function runTour(page: Page, tour: Tour, opts: RunOptions): Promise<void> {
  const { artifactDir } = opts;
  fs.mkdirSync(artifactDir, { recursive: true });
  const screensDir = path.join(artifactDir, "screens");
  fs.mkdirSync(screensDir, { recursive: true });
  const logFile = path.join(artifactDir, "runlog.txt");
  const annotationsFile = path.join(artifactDir, "annotations.jsonl");

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
  const screenshotsByName = new Map<string, string>();
  let lastScreenshotPath: string | undefined;

  try {
    for (let index = 0; index < tour.steps.length; index += 1) {
      lastScreenshotPath = await runStep(
        page,
        tour.steps[index],
        index,
        routeMap,
        logFile,
        screensDir,
        tour.tourId,
        annotationsFile,
        screenshotsByName,
        lastScreenshotPath
      );
    }

    appendRunLog(logFile, `Tour ${tour.tourId} completed at ${new Date().toISOString()}`);
  } catch (error) {
    const stack = error instanceof Error ? error.stack ?? error.message : String(error);
    appendRunLog(logFile, `[ERROR] ${stack}`);
    throw error;
  }
}
