import { expect, test } from '@playwright/test';
import { createTourContext } from '../tour/context';
import { tourStep } from '../tour/tourStep';

test.describe('tour: marketing onboarding walkthrough', () => {
  test('@tour builds onboarding screenshots and narration', async ({ page }, testInfo) => {
    const ctx = await createTourContext(testInfo, 'example-onboarding');

    await tourStep(page, ctx, {
      id: '01',
      title: 'Open the landing page',
      narration:
        'Welcome to ViewBait. This is the landing page where creators discover the product and launch into the studio.',
      action: async (currentPage) => {
        await currentPage.goto('/');
      },
      waitFor: page.getByRole('link', { name: 'Open Studio' }).first(),
    });

    await tourStep(page, ctx, {
      id: '02',
      title: 'Jump to pricing overview',
      narration:
        'Next, we show the pricing section so new users can compare plans and decide how they want to start.',
      action: async (currentPage) => {
        await currentPage.getByRole('link', { name: 'Pricing' }).first().click();
      },
      waitFor: page.getByRole('heading', { name: 'CHOOSE YOUR PLAN' }),
    });

    await tourStep(page, ctx, {
      id: '03',
      title: 'Open the privacy policy',
      narration:
        'Transparency matters. From the footer we open the privacy policy so users can review data handling before signup.',
      action: async (currentPage) => {
        await currentPage.getByRole('link', { name: 'Privacy' }).last().click();
      },
      waitFor: async (currentPage) => {
        await expect(currentPage).toHaveURL(/\/legal\/privacy/);
        await expect(currentPage.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
      },
    });

    await tourStep(page, ctx, {
      id: '04',
      title: 'Open the sign in screen',
      narration:
        'Finally, we take viewers to the authentication screen where creators can sign in and begin generating thumbnails.',
      action: async (currentPage) => {
        await currentPage.goto('/auth');
      },
      waitFor: async (currentPage) => {
        await expect(currentPage).toHaveURL(/\/auth/);
        await expect(currentPage.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
      },
    });
  });
});
