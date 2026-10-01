import { expect, test } from '@playwright/test';
import { collectErrors } from './helpers';

test('loads the garden without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?time=12:00');
  await expect(page.locator('#garden')).toHaveClass(/is-ready/);
  // Let a few more frames render so late shader compiles surface too.
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('renders the canvas inside #garden and fades it in', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#garden canvas')).toHaveCount(1);
  await expect(page.locator('#garden')).toHaveClass(/is-ready/);
  await expect(page.locator('#fallback')).toBeHidden();
});

test('nav link leads to the writing page', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('#site-nav a[href="/writing/"]');
  await expect(link).toBeVisible();
  await expect(link).toHaveText('Writing');
  await link.click();
  await expect(page).toHaveURL(/\/writing\/$/);
  await expect(page.locator('h1')).toHaveText('Writing');
});

test('losing the WebGL context shows the fallback image', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#garden')).toHaveClass(/is-ready/);
  const errors = collectErrors(page);
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#garden canvas');
    canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#garden')).toBeHidden();
  await expect(page.locator('#site-nav a[href="/writing/"]')).toBeVisible();

  // Nothing torn down by the loss may still fire on input or resize.
  await page.mouse.move(200, 200);
  await page.mouse.move(400, 300, { steps: 5 });
  await page.keyboard.press('ArrowLeft');
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
