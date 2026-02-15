import fs from "node:fs";
import path from "node:path";
import type { TestInfo } from "@playwright/test";
import type { TourContext, TourManifest } from "@/tests/tour/types";
import { formatTourMarkdown, slugifyTitle } from "@/tests/tour/utils";

const DEFAULT_ARTIFACTS_ROOT = path.join(process.cwd(), "onboarding", "artifacts");

export function ensureTourArtifactDir({ artifactsRoot, tourName }: { artifactsRoot: string; tourName: string }): string {
  const artifactsDir = path.join(artifactsRoot, tourName);
  fs.rmSync(artifactsDir, { recursive: true, force: true });
  fs.mkdirSync(artifactsDir, { recursive: true });
  return artifactsDir;
}

function deriveTourName(testInfo: TestInfo): string {
  const fileName = path.basename(testInfo.file).replace(/\.(spec|test)\.[cm]?tsx?$/, "");
  const clean = fileName.replace(/\.tour$/, "");
  return slugifyTitle(clean);
}

export function createTourContext(testInfo: TestInfo, explicitTourName?: string): TourContext {
  const tourName = explicitTourName ? slugifyTitle(explicitTourName) : deriveTourName(testInfo);
  const artifactsDir = ensureTourArtifactDir({ artifactsRoot: DEFAULT_ARTIFACTS_ROOT, tourName });

  return {
    tourName,
    artifactsDir,
    manifestPath: path.join(artifactsDir, "tour.json"),
    markdownPath: path.join(artifactsDir, "tour.md"),
    startedAt: new Date().toISOString(),
    steps: [],
  };
}

export function writeTourArtifacts(context: TourContext): TourManifest {
  const manifest: TourManifest = {
    tourName: context.tourName,
    generatedAt: context.startedAt,
    steps: context.steps,
  };

  fs.writeFileSync(context.manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(context.markdownPath, `${formatTourMarkdown(manifest)}\n`);
  return manifest;
}
