import fs from "node:fs/promises";
import path from "node:path";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

export type SelectorTarget = {
  testId?: string;
  role?: string;
  name?: string;
  label?: string;
  text?: string;
};

export type TourStep =
  | { say: string }
  | { click: SelectorTarget }
  | { fill: SelectorTarget & { value?: string; valueEnv?: string } }
  | { select: SelectorTarget & { option: string } }
  | { expect: SelectorTarget };

export interface TourDefinition {
  tourName: string;
  startPath: string;
  steps: TourStep[];
}

export interface TourManifestEntry {
  id: string;
  title: string;
  narration: string;
  screenshot: string;
  timestamp: string;
}

export interface TourManifest {
  tourName: string;
  baseURL: string;
  generatedAt: string;
  steps: TourManifestEntry[];
}

const STABILIZE_TIMEOUT_MS = 6_000;

export function stepId(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function toSlug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return cleaned.length > 0 ? cleaned.slice(0, 60) : "step";
}

export function stepTitle(step: TourStep): string {
  if ("say" in step) return `Narration: ${step.say}`;
  if ("click" in step) return `Click ${targetLabel(step.click)}`;
  if ("fill" in step) return `Fill ${targetLabel(step.fill)}`;
  if ("select" in step) return `Select ${step.select.option} in ${targetLabel(step.select)}`;
  return `Expect ${targetLabel(step.expect)}`;
}

function targetLabel(target: SelectorTarget): string {
  if (target.testId) return `testId:${target.testId}`;
  if (target.role) return `role:${target.role}${target.name ? `(${target.name})` : ""}`;
  if (target.label) return `label:${target.label}`;
  if (target.text) return `text:${target.text}`;
  return "target";
}

async function firstVisible(locator: Locator): Promise<Locator> {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const candidate = locator.nth(i);
    if (await candidate.isVisible()) return candidate;
  }
  return locator.first();
}

export async function resolveTarget(page: Page, target: SelectorTarget): Promise<Locator> {
  if (target.testId) {
    return firstVisible(page.getByTestId(target.testId));
  }

  if (target.role) {
    return firstVisible(page.getByRole(target.role as "button", target.name ? { name: target.name } : undefined));
  }

  if (target.label) {
    return firstVisible(page.getByLabel(target.label, { exact: false }));
  }

  if (target.text) {
    return firstVisible(page.getByText(target.text, { exact: false }));
  }

  throw new Error("Invalid target: provide testId, role, label, or text.");
}

export async function executeStep(page: Page, step: TourStep): Promise<string> {
  if ("say" in step) return step.say;

  if ("click" in step) {
    const target = await resolveTarget(page, step.click);
    await expect(target).toBeVisible();
    await target.click();
    return "";
  }

  if ("fill" in step) {
    const target = await resolveTarget(page, step.fill);
    const value = step.fill.value ?? (step.fill.valueEnv ? process.env[step.fill.valueEnv] : undefined);
    if (value == null) {
      throw new Error(`Missing fill value for ${targetLabel(step.fill)}. Set value or env ${step.fill.valueEnv}.`);
    }
    await expect(target).toBeVisible();
    await target.fill(value);
    return "";
  }

  if ("select" in step) {
    const target = await resolveTarget(page, step.select);
    await expect(target).toBeVisible();

    const tagName = await target.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === "select") {
      await target.selectOption(step.select.option);
      return "";
    }

    await target.click();
    const optionByRole = page.getByRole("option", { name: step.select.option });
    if ((await optionByRole.count()) > 0) {
      await optionByRole.first().click();
      return "";
    }

    const buttonInside = target.getByRole("button", { name: step.select.option });
    if ((await buttonInside.count()) > 0) {
      await buttonInside.first().click();
      return "";
    }

    const textInside = target.getByText(step.select.option, { exact: false });
    if ((await textInside.count()) > 0) {
      await textInside.first().click();
      return "";
    }

    if (step.select.testId === "face-select") {
      const firstFace = page.locator("[data-testid^=\"face-option-\"]").first();
      if ((await firstFace.count()) > 0) {
        await firstFace.click();
        return "";
      }
    }

    if (step.select.testId === "style-select") {
      const firstStyle = page.locator("[data-testid^=\"style-option-\"]").first();
      if ((await firstStyle.count()) > 0) {
        await firstStyle.click();
        return "";
      }
    }

    throw new Error(`Unable to resolve select option \"${step.select.option}\" in ${targetLabel(step.select)}.`);
  }

  const target = await resolveTarget(page, step.expect);
  await expect(target).toBeVisible();
  return "";
}

export async function stabilizePage(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: STABILIZE_TIMEOUT_MS });
  } catch {
    // Ignore, some views stream/poll.
  }
}

export async function runTour(params: {
  page: Page;
  testInfo: TestInfo;
  tour: TourDefinition;
  artifactsRoot?: string;
}): Promise<TourManifest> {
  const { page, testInfo, tour, artifactsRoot = path.join("onboarding", "artifacts") } = params;
  const baseURL = testInfo.project.use.baseURL?.toString() ?? "";
  const tourDir = path.join(artifactsRoot, tour.tourName);

  await fs.rm(tourDir, { recursive: true, force: true });
  await fs.mkdir(tourDir, { recursive: true });

  await page.goto(tour.startPath, { waitUntil: "domcontentloaded" });
  await stabilizePage(page);

  const entries: TourManifestEntry[] = [];

  for (let index = 0; index < tour.steps.length; index += 1) {
    const step = tour.steps[index];
    const id = stepId(index);
    const title = stepTitle(step);

    await testInfo.attach(`tour-step-${id}`, {
      body: Buffer.from(title),
      contentType: "text/plain",
    });

    const narration = await executeStep(page, step);
    await stabilizePage(page);

    const screenshotFile = `${id}-${toSlug(title)}.png`;
    await page.screenshot({ path: path.join(tourDir, screenshotFile), fullPage: true });

    entries.push({
      id,
      title,
      narration,
      screenshot: screenshotFile,
      timestamp: new Date().toISOString(),
    });
  }

  const manifest: TourManifest = {
    tourName: tour.tourName,
    baseURL,
    generatedAt: new Date().toISOString(),
    steps: entries,
  };

  await fs.writeFile(path.join(tourDir, "tour.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const markdown = [
    `# Tour: ${tour.tourName}`,
    "",
    `Generated: ${manifest.generatedAt}`,
    "",
    ...entries.map((entry) => [
      `## ${entry.id}. ${entry.title}`,
      "",
      entry.narration || "(No narration)",
      "",
      `![${entry.title}](./${entry.screenshot})`,
      "",
    ].join("\n")),
  ].join("\n");

  await fs.writeFile(path.join(tourDir, "tour.md"), `${markdown}\n`, "utf8");

  return manifest;
}

export async function loadTour(filePath: string): Promise<TourDefinition> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as TourDefinition;
}
