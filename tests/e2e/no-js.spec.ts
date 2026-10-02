import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('without JavaScript the nav is in the HTML and its Writing link works', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('#site-nav a[href="/writing/"]');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveText('Writing');
  await expect(link).toBeVisible();
  await expect(page.locator('#loader')).toBeHidden();
  await link.click();
  await expect(page).toHaveURL(/\/writing\/$/);
  await expect(page.locator('h1')).toHaveText('Writing');
});
