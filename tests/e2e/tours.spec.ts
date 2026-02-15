import fs from "node:fs/promises";
import path from "node:path";
import { test } from "@playwright/test";
import { loadTour, runTour } from "../../onboarding/tour-runner";

const toursDir = path.join(process.cwd(), "onboarding", "tours");

test.describe("@tour onboarding tours", () => {
  test("run all configured tours", async ({ page }, testInfo) => {
    const files = (await fs.readdir(toursDir)).filter((file) => file.endsWith(".json")).sort();
    test.skip(files.length === 0, "No tour JSON files found.");

    for (const file of files) {
      const tourPath = path.join(toursDir, file);
      const tour = await loadTour(tourPath);

      await test.step(`Run ${tour.tourName}`, async () => {
        await runTour({ page, testInfo, tour });
      });
    }
  });
});
