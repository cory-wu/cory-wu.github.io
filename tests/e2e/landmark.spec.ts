import { expect, test } from '@playwright/test';
import { landmarkPosition, openGarden, SHED_ID } from './helpers';

const DRAG_PX = 80;

test.describe('library shed landmark', () => {
  test.beforeEach(async ({ page }) => {
    await openGarden(page);
  });

  test('hovering shows its label and a pointer cursor; clicking navigates', async ({ page }) => {
    const shed = await landmarkPosition(page, SHED_ID);
    await page.mouse.move(shed.x, shed.y);

    const label = page.locator('#landmark-label');
    await expect(label).toBeVisible();
    await expect(label).toHaveText('Writing');
    await expect(page.locator('#garden canvas')).toHaveCSS('cursor', 'pointer');

    await page.mouse.click(shed.x, shed.y);
    await expect(page).toHaveURL(/\/writing\/$/);
  });

  test('dragging from it orbits instead of navigating', async ({ page }) => {
    const shed = await landmarkPosition(page, SHED_ID);
    const before = page.url();

    await page.mouse.move(shed.x, shed.y);
    await page.mouse.down();
    await page.mouse.move(shed.x - DRAG_PX, shed.y, { steps: 8 });
    await page.mouse.up();

    // Give a would-be navigation time to start before checking it didn't.
    await page.waitForTimeout(300);
    expect(page.url()).toBe(before);
  });
});

test('the e2e hook is absent from a normal production load', async ({ page }) => {
  await page.goto('/?time=12:00');
  await expect(page.locator('#garden')).toHaveClass(/is-ready/);
  expect(await page.evaluate(() => window.__garden)).toBeUndefined();
});
