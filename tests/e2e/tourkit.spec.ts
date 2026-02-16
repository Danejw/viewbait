import { test, expect } from "@playwright/test";

test("@tourkit bootstrap: app loads and env is present", async ({ page }) => {
  // Verify app is reachable
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();

  // Verify TourKit env is loaded (boolean presence only)
  expect(
    process.env.E2E_EMAIL,
    "E2E_EMAIL is missing. Fill tourkit/.env.tourkit"
  ).toBeTruthy();
  expect(
    process.env.E2E_PASSWORD,
    "E2E_PASSWORD is missing. Fill tourkit/.env.tourkit"
  ).toBeTruthy();
});
