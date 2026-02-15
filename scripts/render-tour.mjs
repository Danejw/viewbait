#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tourName = process.argv[2];

if (!tourName) {
  console.error('Usage: npm run tour:render -- <tour-name>');
  process.exit(1);
}

const artifactDir = path.join(process.cwd(), 'onboarding', 'artifacts', tourName);
const manifestPath = path.join(artifactDir, 'tour.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing manifest: ${manifestPath}`);
  process.exit(1);
}

const ffmpegCheck = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
if (ffmpegCheck.status !== 0) {
  console.error('ffmpeg is not installed. Install ffmpeg to use tour:render.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.steps) || manifest.steps.length === 0) {
  console.error('tour.json has no steps to render.');
  process.exit(1);
}

const concatInput = manifest.steps
  .map((step) => {
    const durationMs = Number.isFinite(step.durationMs) ? Math.max(step.durationMs, 800) : 1500;
    const durationS = (durationMs / 1000).toFixed(3);
    const imagePath = path.resolve(artifactDir, step.screenshot).replace(/'/g, "'\\''");
    return `file '${imagePath}'\nduration ${durationS}`;
  })
  .join('\n');

const concatPath = path.join(artifactDir, 'tour.concat.txt');
fs.writeFileSync(concatPath, `${concatInput}\n`, 'utf8');

const outputPath = path.join(artifactDir, 'tour-slideshow.mp4');
const result = spawnSync(
  'ffmpeg',
  ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-vsync', 'vfr', '-pix_fmt', 'yuv420p', outputPath],
  { stdio: 'inherit' }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Created slideshow video: ${outputPath}`);
