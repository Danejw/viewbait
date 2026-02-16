import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "@playwright/test";

// Load TourKit env BEFORE Playwright reads config
dotenv.config({ path: path.resolve(process.cwd(), "tourkit/.env.tourkit") });

// Fail fast: tours need auth credentials
const hasEmail = Boolean(
  process.env.E2E_EMAIL && process.env.E2E_EMAIL !== "your_test_email@example.com"
);
const hasPassword = Boolean(
  process.env.E2E_PASSWORD && process.env.E2E_PASSWORD !== "your_test_password"
);
if (!hasEmail || !hasPassword) {
  console.error("\n╔══════════════════════════════════════════════════════╗");
  console.error("║  TourKit: Missing E2E credentials                    ║");
  console.error("║                                                      ║");
  console.error("║  1. Copy tourkit/.env.tourkit.example                 ║");
  console.error("║     to   tourkit/.env.tourkit                         ║");
  console.error("║  2. Fill in E2E_EMAIL and E2E_PASSWORD                ║");
  console.error("╚══════════════════════════════════════════════════════╝\n");
  console.error(`  E2E_EMAIL present: ${hasEmail}`);
  console.error(`  E2E_PASSWORD present: ${hasPassword}\n`);
  process.exit(1);
}

export default defineConfig({
  testDir: "./tests/e2e",
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: process.env.TOURKIT_CAPTURE === "1" ? "on" : "on-first-retry",
    video: process.env.TOURKIT_CAPTURE === "1" ? "on" : "retain-on-failure",
    screenshot: process.env.TOURKIT_CAPTURE === "1" ? "on" : "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
