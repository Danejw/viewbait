import path from "node:path";
import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { writeTourArtifacts } from "@/tests/tour/context";
import type { TourContext, TourStepDefinition } from "@/tests/tour/types";
import { slugifyTitle } from "@/tests/tour/utils";

async function stabilizePage(page: Page): Promise<void> {
  try {
    await page.waitForLoadState("networkidle", { timeout: 5_000 });
  } catch {
    await page.waitForTimeout(400);
  }
}

export async function tourStep(page: Page, context: TourContext, step: TourStepDefinition): Promise<void> {
  await test.step(step.title, async () => {
    const started = Date.now();
    await step.action(page);

    if (step.waitFor) {
      if (typeof step.waitFor === "function") {
        await step.waitFor(page);
      } else {
        await step.waitFor.waitFor({ state: "visible" });
      }
    }

    await stabilizePage(page);

    const screenshot = `${step.id}-${slugifyTitle(step.title)}.png`;
    const screenshotPath = path.join(context.artifactsDir, screenshot);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    context.steps.push({
      id: step.id,
      title: step.title,
      narration: step.narration,
      screenshot,
      timestamp: new Date().toISOString(),
      durationMs: step.durationMs ?? Date.now() - started,
    });

    writeTourArtifacts(context);
  });
}
