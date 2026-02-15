import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;
const isTourMode = process.env.TOUR_MODE === "1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: isTourMode ? "on" : "retain-on-failure",
    screenshot: "off",
    video: isTourMode ? "on" : "retain-on-failure",
    viewport: isTourMode ? { width: 1440, height: 900 } : { width: 1280, height: 720 },
  },
  webServer: {
    command: "npm run dev -- --port 3000",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
