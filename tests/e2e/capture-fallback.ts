import { expect, test } from '@playwright/test';
import { openGarden } from './helpers';

/**
 * Captures the noon garden for the no-WebGL fallback. Not part of the default
 * e2e run: `npm run capture:fallback` runs it via playwright.capture.config.ts
 * and converts the PNG to public/garden-fallback.webp with cwebp.
 */
const CAPTURE_PNG = 'test-results/garden-fallback.png';

const SETTLE_MS = 500;

test.use({ viewport: { width: 1600, height: 1000 } });

test('capture the static fallback image', async ({ page }) => {
  await openGarden(page, '12:00');
  // Keep UI chrome out of the image; the real nav sits on top of the fallback.
  await page.addStyleTag({
    content: '.garden-card, #reset-view, #landmark-label { visibility: hidden !important; }',
  });
  await page.waitForTimeout(SETTLE_MS);
  await page.locator('#garden').screenshot({ path: CAPTURE_PNG });
  await expect(page.locator('#garden')).toBeVisible();
});
