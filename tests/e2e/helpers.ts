import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const SHED_ID = 'library-shed';

/** Records console errors and uncaught page errors for later assertion. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/** Opens the garden with the e2e hook enabled and waits for the first frame. */
export async function openGarden(page: Page, time = '12:00'): Promise<void> {
  await page.goto(`/?time=${time}&e2e`);
  await expect(page.locator('#garden')).toHaveClass(/is-ready/);
}

/** Viewport CSS-pixel position of a landmark's projected centre, via window.__garden. */
export async function landmarkPosition(page: Page, id: string): Promise<{ x: number; y: number }> {
  const pos = await page.evaluate((landmarkId) => window.__garden?.landmarkScreenPosition(landmarkId) ?? null, id);
  if (!pos) throw new Error(`landmark "${id}" has no screen position`);
  return pos;
}
