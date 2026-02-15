import { expect, test } from "@playwright/test";
import { createTourContext } from "@/tests/tour/context";
import { tourStep } from "@/tests/tour/tourStep";

test.describe("@tour onboarding: landing page walkthrough", () => {
  test("captures onboarding screenshots and narration", async ({ page }, testInfo) => {
    const context = createTourContext(testInfo, "example-onboarding");

    await tourStep(page, context, {
      id: "01",
      title: "Open home",
      narration: "Welcome to ViewBait. We start on the landing page where creators discover the product value.",
      action: async (activePage) => {
        await activePage.goto("/");
      },
      waitFor: async (activePage) => {
        await expect(activePage).toHaveTitle(/ViewBait/i);
      },
    });

    await tourStep(page, context, {
      id: "02",
      title: "Navigate to pricing section",
      narration: "Next we jump to pricing so viewers can understand plan options and upgrade paths.",
      action: async (activePage) => {
        await activePage.locator('a[href="#pricing"]').first().click();
      },
      waitFor: page.getByRole("heading", { name: /Pricing/i }),
    });

    await tourStep(page, context, {
      id: "03",
      title: "Open product section",
      narration: "Now we move back to product highlights to show the core workflow and generated thumbnail previews.",
      action: async (activePage) => {
        await activePage.locator('a[href="#product"]').first().click();
      },
      waitFor: page.getByText(/Generate Thumbnail Variants/i),
    });

    await tourStep(page, context, {
      id: "04",
      title: "Open studio call to action",
      narration: "Finally, we focus on the primary call to action that sends users into the studio experience.",
      action: async (activePage) => {
        await activePage.getByRole("link", { name: /Open Studio/i }).first().hover();
      },
      waitFor: page.getByRole("link", { name: /Open Studio/i }).first(),
    });
  });
});
