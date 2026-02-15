import path from 'node:path';
import { test, type Locator, type Page } from '@playwright/test';
import type { TourContext } from './context';

type WaitForHandler = (page: Page) => Promise<void>;

export interface TourStepDefinition {
  id: string;
  title: string;
  narration: string;
  action: (page: Page) => Promise<void>;
  waitFor?: Locator | WaitForHandler;
  durationMs?: number;
}

async function stabilize(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: 5_000 });
  } catch {
    await page.waitForTimeout(300);
  }
}

async function runWaitFor(page: Page, waitFor?: Locator | WaitForHandler): Promise<void> {
  if (!waitFor) {
    return;
  }

  if (typeof waitFor === 'function') {
    await waitFor(page);
    return;
  }

  await waitFor.waitFor({ state: 'visible' });
}

export async function tourStep(page: Page, context: TourContext, step: TourStepDefinition): Promise<void> {
  await test.step(`${step.id} ${step.title}`, async () => {
    const startedAt = Date.now();

    await step.action(page);
    await runWaitFor(page, step.waitFor);
    await stabilize(page);

    const screenshot = `${step.id}-${context.slugify(step.title)}.png`;
    const screenshotPath = path.join(context.artifactDir, screenshot);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await context.addStep({
      id: step.id,
      title: step.title,
      narration: step.narration,
      screenshot,
      timestamp: new Date().toISOString(),
      durationMs: step.durationMs ?? Date.now() - startedAt,
    });
  });
}
