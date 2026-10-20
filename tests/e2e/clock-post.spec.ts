import { expect, test } from '@playwright/test';
import { BOOKING_URL, CLOCK_ID, landmarkPosition, openGarden } from './helpers';

test.describe('clock post landmark', () => {
  test.beforeEach(async ({ page, context }) => {
    // Keep the run offline: answer cal.com requests locally.
    await context.route('https://cal.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>cal</title>' }));
    await openGarden(page);
  });

  test('hovering shows its label; clicking opens the booking page in a new tab', async ({ page, context }) => {
    const clock = await landmarkPosition(page, CLOCK_ID);
    await page.mouse.move(clock.x, clock.y);
    await expect(page.locator('#landmark-label')).toHaveText('Meet with me');

    const popup = context.waitForEvent('page');
    await page.mouse.click(clock.x, clock.y);
    const booking = await popup;
    await booking.waitForLoadState();
    expect(booking.url()).toBe(BOOKING_URL);
    // The garden stays open behind it, and the new tab has no handle back to it.
    expect(page.url()).toContain('/?time=');
    expect(await booking.evaluate(() => window.opener)).toBeNull();
  });

  test('its nav link opens the booking page in a new tab', async ({ page }) => {
    const link = page.locator(`#site-nav-list a[data-landmark-id="${CLOCK_ID}"]`);
    await expect(link).toHaveAttribute('href', BOOKING_URL);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAccessibleName('Meet with me (opens in a new tab)');
  });
});
