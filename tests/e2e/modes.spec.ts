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
