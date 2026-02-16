import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { runTour } from "../../tourkit/runner/runTour";

test.describe("TourKit Tours", () => {
  test("@tourkit dynamic tour from TOUR_FILE", async ({ page }, testInfo) => {
    const tourFile = process.env.TOUR_FILE;
    test.skip(!tourFile, "No TOUR_FILE env var set. Use: cross-env TOUR_FILE=tourkit/tours/<id>.tour.json");

    const tourPath = path.resolve(process.cwd(), String(tourFile));
    const tour = JSON.parse(fs.readFileSync(tourPath, "utf-8")) as {
      tourId: string;
      description?: string;
      steps: Array<Record<string, unknown>>;
    };

    const tourId = tour.tourId;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const artifactDir = path.resolve(process.cwd(), `tourkit/artifacts/${tourId}/${timestamp}`);

    fs.mkdirSync(path.join(artifactDir, "screens"), { recursive: true });

    await runTour(page, tour, { artifactDir, testInfo });

    const video = page.video();
    if (video) {
      const videoPath = await video.path();
      if (videoPath && fs.existsSync(videoPath)) {
        fs.copyFileSync(videoPath, path.join(artifactDir, "video.webm"));
      }
    }

    const traceZip = fs
      .readdirSync(testInfo.outputDir)
      .find((fileName) => fileName.endsWith(".zip") && fileName.toLowerCase().includes("trace"));

    if (traceZip) {
      fs.copyFileSync(path.join(testInfo.outputDir, traceZip), path.join(artifactDir, "trace.zip"));
    }
  });
});
