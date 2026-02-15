import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const tourName = process.argv[2];

if (!tourName) {
  console.error("Usage: npm run tour:render -- <tour-name>");
  process.exit(1);
}

const tourDir = path.join(process.cwd(), "onboarding", "artifacts", tourName);
const manifestPath = path.join(tourDir, "tour.json");

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing manifest: ${manifestPath}`);
  process.exit(1);
}

const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
if (ffmpegCheck.status !== 0) {
  console.error("ffmpeg is required for tour:render. Install ffmpeg and rerun.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const concatFile = path.join(os.tmpdir(), `tour-${tourName}-${Date.now()}.txt`);

const lines = [];
for (const step of manifest.steps) {
  const imagePath = path.join(tourDir, step.screenshot);
  const duration = Number(step.durationMs ?? 1500) / 1000;
  lines.push(`file '${imagePath.replace(/'/g, "'\\''")}'`);
  lines.push(`duration ${duration.toFixed(2)}`);
}
if (manifest.steps.length > 0) {
  const lastImage = path.join(tourDir, manifest.steps[manifest.steps.length - 1].screenshot);
  lines.push(`file '${lastImage.replace(/'/g, "'\\''")}'`);
}

fs.writeFileSync(concatFile, `${lines.join("\n")}\n`);

const outputPath = path.join(tourDir, `${tourName}.mp4`);
const result = spawnSync(
  "ffmpeg",
  ["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-vf", "fps=30,format=yuv420p", outputPath],
  { stdio: "inherit" }
);

fs.rmSync(concatFile, { force: true });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Rendered slideshow video: ${outputPath}`);
