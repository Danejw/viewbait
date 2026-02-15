import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const tourMode = process.env.TOUR_MODE === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["dot"], ["html", { open: "never" }]] : [["list"]],
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    headless: true,
    video: tourMode ? "on" : "retain-on-failure",
    trace: tourMode ? "on" : "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

