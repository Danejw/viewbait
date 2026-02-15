import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TestInfo } from '@playwright/test';

export interface TourManifestStep {
  id: string;
  title: string;
  narration: string;
  screenshot: string;
  timestamp: string;
  durationMs: number;
}

interface TourManifest {
  tourName: string;
  generatedAt: string;
  steps: TourManifestStep[];
}

export interface TourContext {
  tourName: string;
  artifactDir: string;
  slugify: (value: string) => string;
  addStep: (step: TourManifestStep) => Promise<void>;
}

function buildMarkdown(manifest: TourManifest): string {
  const lines = [`# ${manifest.tourName} narration script`, ''];

  for (const step of manifest.steps) {
    lines.push(`## ${step.id}. ${step.title}`);
    lines.push('');
    lines.push(`- Narration: ${step.narration}`);
    lines.push(`- Screenshot: ${step.screenshot}`);
    lines.push(`- Suggested duration: ${step.durationMs}ms`);
    lines.push('');
  }

  return lines.join('\n');
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function inferTourName(testInfo: TestInfo): string {
  const fileName = path.basename(testInfo.file);
  return fileName
    .replace(/\.spec\.(ts|tsx)$/, '')
    .replace(/\.tour$/, '')
    .replace(/\.(ts|tsx)$/, '');
}

export async function createTourContext(testInfo: TestInfo, explicitTourName?: string): Promise<TourContext> {
  const tourName = slugify(explicitTourName ?? inferTourName(testInfo));
  const artifactDir = path.join(process.cwd(), 'onboarding', 'artifacts', tourName);

  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });

  const manifest: TourManifest = {
    tourName,
    generatedAt: new Date().toISOString(),
    steps: [],
  };

  const persist = async () => {
    await writeFile(path.join(artifactDir, 'tour.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await writeFile(path.join(artifactDir, 'tour.md'), buildMarkdown(manifest), 'utf8');
  };

  await persist();

  return {
    tourName,
    artifactDir,
    slugify,
    addStep: async (step) => {
      manifest.steps.push(step);
      await persist();
    },
  };
}
