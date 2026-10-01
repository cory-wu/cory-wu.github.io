import { expect, test } from '@playwright/test';
import { landmarkPosition, openGarden, SHED_ID } from './helpers';

const SETTLE_MS = 300;

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('renders no continuous animation', async ({ page }) => {
    await openGarden(page);
    await page.waitForTimeout(SETTLE_MS);
    const first = await page.screenshot();
    await page.waitForTimeout(1000);
    const second = await page.screenshot();
    expect(second).toEqual(first);
  });
});

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('frames the shed inside the viewport', async ({ page }) => {
    await openGarden(page);
    const shed = await landmarkPosition(page, SHED_ID);
    expect(shed.x).toBeGreaterThan(0);
    expect(shed.x).toBeLessThan(390);
    expect(shed.y).toBeGreaterThan(0);
    expect(shed.y).toBeLessThan(844);
  });
});

test.describe('rotating from desktop to phone', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('re-frames like a fresh phone load, with the shed inside the viewport', async ({ page }) => {
    await openGarden(page);
    await page.setViewportSize({ width: 390, height: 844 });
    // The shed sits near the top-centre of the frame, so "inside the viewport" alone
    // also holds for the cropped desktop framing; compare against a fresh phone load too.
    await page.waitForTimeout(SETTLE_MS);
    const rotated = await landmarkPosition(page, SHED_ID);
    expect(rotated.x).toBeGreaterThan(0);
    expect(rotated.x).toBeLessThan(390);
    expect(rotated.y).toBeGreaterThan(0);
    expect(rotated.y).toBeLessThan(844);

    await openGarden(page);
    await page.waitForTimeout(SETTLE_MS);
    const fresh = await landmarkPosition(page, SHED_ID);
    expect(Math.abs(rotated.x - fresh.x)).toBeLessThan(2);
    expect(Math.abs(rotated.y - fresh.y)).toBeLessThan(2);
  });
});

test.describe('time of day review screenshots', () => {
  for (const time of ['06:30', '12:00', '18:00', '22:00']) {
    test(`captures the garden at ${time}`, async ({ page }, testInfo) => {
      await openGarden(page, time);
      await page.waitForTimeout(SETTLE_MS);
      // For human review only; written under test-results/ (gitignored).
      await page.screenshot({ path: testInfo.outputPath(`garden-${time.replace(':', '')}.png`) });
    });
  }
});
