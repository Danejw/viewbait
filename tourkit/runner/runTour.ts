import fs from "node:fs";
import path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";
import routesConfig from "@/tourkit/config/routes.json";

export interface TourStep {
  type: "say" | "goto" | "click" | "fill" | "expectVisible" | "waitForEvent" | "waitMs" | "snapshot";
  [key: string]: unknown;
}

export interface Tour {
  tourId: string;
  description?: string;
  steps: TourStep[];
}

export interface RunOptions {
  artifactDir: string;
  testInfo: TestInfo;
}

interface RouteEntry {
  routeKey: string;
  path: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function resolveRoutePath(routeKey: string): string {
  const route = (routesConfig.routes as RouteEntry[]).find((entry) => entry.routeKey === routeKey);
  if (!route) {
    throw new Error(`Unknown routeKey: ${routeKey}`);
  }
  return route.path;
}

function shouldForceTourParam(): boolean {
  const mode = process.env.TOUR_MODE;
  return mode === "tour_mode" || mode === "1" || process.env.NEXT_PUBLIC_TOUR_MODE === "1";
}

function withTourQuery(routePath: string): string {
  if (!shouldForceTourParam()) return routePath;

  const [pathname, rawSearch = ""] = routePath.split("?");
  const params = new URLSearchParams(rawSearch);
  params.set("tour", "1");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function appendRunlog(artifactDir: string, line: string): void {
  const runlogPath = path.join(artifactDir, "runlog.txt");
  fs.appendFileSync(runlogPath, `${new Date().toISOString()} ${line}\n`, "utf8");
}

function formatStepMeta(step: TourStep): string {
  return (
    (typeof step.anchor === "string" && `anchor=${step.anchor}`) ||
    (typeof step.routeKey === "string" && `routeKey=${step.routeKey}`) ||
    (typeof step.name === "string" && `name=${step.name}`) ||
    ""
  );
}

function isRetryableActionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("detached") ||
    lower.includes("intercept") ||
    lower.includes("not attached") ||
    lower.includes("not visible") ||
    lower.includes("retry")
  );
}

async function safeClick(page: Page, anchor: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  const selector = `[data-tour="${anchor}"]`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: Math.min(5000, Math.max(250, deadline - Date.now())) });
      await locator.click({ timeout: 5000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isRetryableActionError(message)) {
        await page.waitForTimeout(200);
        continue;
      }
      if (Date.now() >= deadline) throw error;
      await page.waitForTimeout(200);
    }
  }

  throw new Error(`safeClick timed out for anchor: ${anchor} (${timeoutMs}ms)`);
}

async function safeFill(page: Page, anchor: string, value: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  const selector = `[data-tour="${anchor}"]`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible", timeout: Math.min(5000, Math.max(250, deadline - Date.now())) });
      await locator.fill(value, { timeout: 5000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isRetryableActionError(message)) {
        await page.waitForTimeout(200);
        continue;
      }
      if (Date.now() >= deadline) throw error;
      await page.waitForTimeout(200);
    }
  }

  throw new Error(`safeFill timed out for anchor: ${anchor} (${timeoutMs}ms)`);
}

async function waitForEvent(page: Page, eventName: string, timeoutMs: number): Promise<void> {
  const alreadyFired = await page.evaluate((name) => {
    return ((window as unknown as { __tourkit_events?: Array<{ type: string }> }).__tourkit_events || []).some(
      (event) => event.type === name
    );
  }, eventName);

  if (alreadyFired) return;

  await page.waitForFunction(
    (name) =>
      ((window as unknown as { __tourkit_events?: Array<{ type: string }> }).__tourkit_events || []).some(
        (event) => event.type === name
      ),
    eventName,
    { timeout: timeoutMs }
  );
}

export async function runTour(page: Page, tour: Tour, opts: RunOptions): Promise<void> {
  fs.mkdirSync(path.join(opts.artifactDir, "screens"), { recursive: true });

  await page.addInitScript(() => {
    const globalWindow = window as unknown as {
      __tourkit_events?: Array<{ type: string; detail: unknown; time: number }>;
      __tourkit_original_dispatch__?: (event: Event) => boolean;
    };

    globalWindow.__tourkit_events = globalWindow.__tourkit_events || [];

    if (!globalWindow.__tourkit_original_dispatch__) {
      globalWindow.__tourkit_original_dispatch__ = window.dispatchEvent.bind(window);
      window.dispatchEvent = (event: Event) => {
        if (event.type.startsWith("tour.event.")) {
          globalWindow.__tourkit_events?.push({
            type: event.type,
            detail: (event as CustomEvent).detail,
            time: Date.now(),
          });
        }
        return globalWindow.__tourkit_original_dispatch__?.(event) ?? true;
      };
    }
  });

  appendRunlog(opts.artifactDir, `[tour:start] ${tour.tourId}`);

  for (let index = 0; index < tour.steps.length; index += 1) {
    const step = tour.steps[index];
    const stepNo = index + 1;
    const meta = formatStepMeta(step);
    appendRunlog(opts.artifactDir, `[step:${stepNo}] type=${step.type}${meta ? ` ${meta}` : ""} url=${page.url()}`);

    try {
      if (step.type === "say") {
        appendRunlog(opts.artifactDir, `[say] ${String(step.message ?? "")}`);
        continue;
      }

      if (step.type === "goto") {
        const routeKey = String(step.routeKey ?? "");
        const routePath = resolveRoutePath(routeKey);
        await page.goto(withTourQuery(routePath), { waitUntil: "domcontentloaded" });
        continue;
      }

      if (step.type === "click") {
        await safeClick(page, String(step.anchor ?? ""), Number(step.timeoutMs ?? DEFAULT_TIMEOUT_MS));
        continue;
      }

      if (step.type === "fill") {
        const valueFromEnv = typeof step.valueEnv === "string" ? process.env[step.valueEnv] : undefined;
        const value = typeof step.value === "string" ? step.value : valueFromEnv;
        if (typeof value !== "string") {
          throw new Error(`fill step missing value for anchor ${String(step.anchor ?? "")}`);
        }
        await safeFill(page, String(step.anchor ?? ""), value, Number(step.timeoutMs ?? DEFAULT_TIMEOUT_MS));
        continue;
      }

      if (step.type === "expectVisible") {
        const timeoutMs = Number(step.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        await expect(page.locator(`[data-tour="${String(step.anchor ?? "")}"]`).first()).toBeVisible({ timeout: timeoutMs });
        continue;
      }

      if (step.type === "waitForEvent") {
        await waitForEvent(page, String(step.name ?? ""), Number(step.timeoutMs ?? DEFAULT_TIMEOUT_MS));
        continue;
      }

      if (step.type === "waitMs") {
        await page.waitForTimeout(Number(step.ms ?? 0));
        continue;
      }

      if (step.type === "snapshot") {
        const snapshotName = String(step.name ?? `step-${stepNo}`)
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, "-")
          .replace(/^-+|-+$/g, "");
        const outputPath = path.join(opts.artifactDir, "screens", `${String(stepNo).padStart(2, "0")}_${snapshotName}.png`);
        await page.screenshot({ path: outputPath, fullPage: true });
        continue;
      }

      throw new Error(`Unsupported step type: ${String((step as { type?: string }).type)}`);
    } catch (error) {
      appendRunlog(
        opts.artifactDir,
        `[step:${stepNo}:error] ${(error as Error).message}\n${(error as Error).stack ?? "(no stack)"}`
      );
      throw error;
    }
  }

  appendRunlog(opts.artifactDir, `[tour:complete] ${tour.tourId}`);
}
