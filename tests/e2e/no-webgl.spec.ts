import { expect, test } from '@playwright/test';

// Launch flags force a fresh browser, so they must be file-level; this file
// replaces the project's swiftshader flags with WebGL switched off entirely.
test.use({ launchOptions: { args: ['--disable-webgl', '--disable-3d-apis'] } });

test('without WebGL the fallback image and a working nav are shown', async ({ page }) => {
  await page.goto('/');
  const fallback = page.locator('#fallback');
  await expect(fallback).toBeVisible();
  await expect(page.locator('#garden')).toBeHidden();
  await expect(page.locator('#garden canvas')).toHaveCount(0);
  const loaded = await fallback.evaluate((img: HTMLImageElement) =>
    img.decode().then(
      () => img.naturalWidth > 0,
      () => false,
    ),
  );
  expect(loaded).toBe(true);

  await page.locator('#site-nav a[href="/writing/"]').click();
  await expect(page).toHaveURL(/\/writing\/$/);
});
