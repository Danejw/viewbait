import { test, expect } from '@playwright/test';

test('@tourkit placeholder loads home page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\//);
});
