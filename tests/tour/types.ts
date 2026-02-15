import type { Locator, Page } from "@playwright/test";

export type TourManifestStep = {
  id: string;
  title: string;
  narration: string;
  screenshot: string;
  timestamp: string;
  durationMs?: number;
};

export type TourManifest = {
  tourName: string;
  generatedAt: string;
  steps: TourManifestStep[];
};

export type TourWaitFor = Locator | ((page: Page) => Promise<void>);

export type TourStepDefinition = {
  id: string;
  title: string;
  narration: string;
  action: (page: Page) => Promise<void>;
  waitFor?: TourWaitFor;
  durationMs?: number;
};

export type TourContext = {
  tourName: string;
  artifactsDir: string;
  manifestPath: string;
  markdownPath: string;
  startedAt: string;
  steps: TourManifestStep[];
};
