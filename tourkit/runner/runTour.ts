import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { ensureTourParam } from "@/tourkit/app/tourMode";
import { anchorLocator } from "@/tourkit/app/tourSelectors";

type TourStep =
  | { type: "say"; text: string }
  | { type: "goto"; routeKey: string }
  | { type: "click"; anchor: string }
  | { type: "fill"; anchor: string; value?: string; valueEnv?: string }
  | { type: "expectVisible"; anchor: string }
  | { type: "waitForEvent"; name: string; timeoutMs?: number }
  | { type: "waitMs"; durationMs: number }
  | { type: "snapshot"; name: string };

export type Tour = {
  id: string;
  title?: string;
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

function nowIsoCompact(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
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

async function safeClick(page: Page, anchor: string): Promise<void> {
  const locator = page.locator(anchorLocator(anchor)).first();
  await locator.waitFor({ state: "visible", timeout: 30_000 });
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
}

async function waitForTourEvent(page: Page, eventName: string, timeoutMs = 30_000): Promise<unknown> {
  return await page.evaluate(
    ({ name, timeout }) =>
      new Promise((resolvePromise, rejectPromise) => {
        const timer = window.setTimeout(() => {
          window.removeEventListener(name, handler as EventListener);
          rejectPromise(new Error(`Timed out waiting for ${name} after ${timeout}ms`));
        }, timeout);

        const handler = (event: Event) => {
          window.clearTimeout(timer);
          window.removeEventListener(name, handler as EventListener);
          resolvePromise((event as CustomEvent).detail);
        };

        window.addEventListener(name, handler as EventListener, { once: true });
      }),
    { name: eventName, timeout: timeoutMs }
  );
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

  log(`tour=${tour.id} stepCount=${tour.steps.length} started=${startedAt}`);

  for (let i = 0; i < tour.steps.length; i += 1) {
    const step = tour.steps[i];
    const stepNumber = i + 1;
    log(`step ${stepNumber}/${tour.steps.length}: ${step.type}`);

    switch (step.type) {
      case "say": {
        log(`say: ${step.text}`);
        break;
      }
      case "goto": {
        const route = map.routes[step.routeKey];
        if (!route) {
          throw new Error(`Unknown routeKey '${step.routeKey}' in step ${stepNumber}`);
        }
        const base = process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const url = ensureTourParam(`${base}${route.path}`);
        log(`goto: ${step.routeKey} => ${url}`);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        break;
      }
      case "click": {
        await safeClick(page, step.anchor);
        break;
      }
      case "fill": {
        const value = step.valueEnv ? process.env[step.valueEnv] : step.value;
        if (!value) {
          throw new Error(`Missing fill value for '${step.anchor}' (value/valueEnv)`);
        }
        const locator = page.locator(anchorLocator(step.anchor)).first();
        await locator.waitFor({ state: "visible", timeout: 30_000 });
        await locator.scrollIntoViewIfNeeded();
        await locator.fill(value);
        break;
      }
      case "expectVisible": {
        await page.locator(anchorLocator(step.anchor)).first().waitFor({ state: "visible", timeout: 30_000 });
        break;
      }
      case "waitForEvent": {
        const detail = await waitForTourEvent(page, step.name, step.timeoutMs ?? 30_000);
        log(`event: ${step.name} detail=${JSON.stringify(detail)}`);
        break;
      }
      case "waitMs": {
        await page.waitForTimeout(step.durationMs);
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
  if (file.endsWith(".tour.json")) {
    return file.slice(0, -".tour.json".length);
  }
  return file.replace(extname(file), "");
}
