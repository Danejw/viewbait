import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { runTour, type Tour } from "../../tourkit/runner/runTour";

const tourFile = process.env.TOUR_FILE;

test.describe("TourKit Tours", () => {
  test.skip(!tourFile, "No TOUR_FILE env var set. Use: cross-env TOUR_FILE=tourkit/tours/<id>.tour.json");

  if (!tourFile) return;

  const tourPath = path.resolve(process.cwd(), tourFile);
  const tour = JSON.parse(fs.readFileSync(tourPath, "utf8")) as Tour;
  const tourId = tour.tourId;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const artifactDir = path.resolve(process.cwd(), `tourkit/artifacts/${tourId}/${timestamp}`);

  test(`@tourkit @tour:${tourId} — ${tour.description || tourId}`, async ({ page }, testInfo) => {
    fs.mkdirSync(path.join(artifactDir, "screens"), { recursive: true });

    // Navigation can be slow on auth routes / cold start
    page.setDefaultNavigationTimeout(90_000);
    page.setDefaultTimeout(30_000);

    await runTour(page, tour, { artifactDir, testInfo });

    const video = page.video();
    if (video) {
      const videoPath = await video.path();
      if (videoPath && fs.existsSync(videoPath)) {
        fs.copyFileSync(videoPath, path.join(artifactDir, "video.webm"));
      }
    }

    const traceCandidates = ["trace.zip", "trace.trace", "trace.network"];
    for (const candidate of traceCandidates) {
      const source = path.join(testInfo.outputDir, candidate);
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, path.join(artifactDir, candidate));
      }
    }
  });
});
