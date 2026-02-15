import { mkdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { test } from "@playwright/test";
import { inferTourIdFromFile, runTour, type Tour } from "@/tourkit/runner/runTour";

const tourFile = process.env.TOUR_FILE;

if (!tourFile) {
  throw new Error("TOUR_FILE env var is required. Example: TOUR_FILE=tourkit/tours/first-thumbnail.tour.json");
}

const absoluteTourFile = resolve(process.cwd(), tourFile);
const tour = JSON.parse(readFileSync(absoluteTourFile, "utf8")) as Tour;
const tourId = inferTourIdFromFile(absoluteTourFile);

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

test(`@tourkit @tour:${tourId} run ${basename(absoluteTourFile)}`, async ({ page }, testInfo) => {
  const artifactDir = resolve(process.cwd(), "tourkit/artifacts", tourId, nowStamp());
  mkdirSync(artifactDir, { recursive: true });

  await runTour(page, { ...tour, id: tourId }, { artifactDir, testInfo });
});
