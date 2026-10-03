import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { collectErrors } from './helpers';

const TEXT_PAGE_FONT_BUDGET = 150_000;
const GARDEN_FONT_BUDGET = 90_000;

/** Sums the bytes of every .woff2 response the page receives. */
function trackFonts(page: Page): { urls: string[]; bytes: () => Promise<number> } {
  const pending: Array<Promise<number>> = [];
  const urls: string[] = [];
  page.on('response', (res) => {
    if (!res.url().endsWith('.woff2')) return;
    urls.push(res.url());
    pending.push(res.body().then((b) => b.length));
  });
  return { urls, bytes: async () => (await Promise.all(pending)).reduce((a, b) => a + b, 0) };
}

test.describe('text page shell', () => {
  test('wraps /writing/ in the top bar and footer with Writing marked current', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/writing/');
    await expect(page.locator('.site-bar')).toBeVisible();
    await expect(page.locator('.site-footer')).toBeVisible();
    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText('Writing');
    await expect(page.locator('script')).toHaveCount(0);
    await page.locator('.site-footer a', { hasText: 'Back to the garden' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(errors).toEqual([]);
  });

  test('puts the skip link first and moves focus into the content', async ({ page }) => {
    await page.goto('/writing/');
    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    expect(box && box.x >= 0 && box.y >= 0).toBe(true);
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.activeElement?.closest('#content') !== null)).toBe(true);
  });

  test('keeps long code, URLs and tables from scrolling the page on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/writing/');
    await page.evaluate(() => {
      const main = document.getElementById('content')!;
      const pre = document.createElement('pre');
      pre.innerHTML = `<code>${'x'.repeat(300)}</code>`;
      const link = document.createElement('p');
      link.innerHTML = `<a href="#">https://example.com/${'a'.repeat(150)}</a>`;
      const table = document.createElement('table');
      table.innerHTML = `<tr>${'<td>wide&nbsp;table&nbsp;cell&nbsp;content</td>'.repeat(6)}</tr>`;
      main.append(pre, link, table);
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe('fonts', () => {
  test('load the journal fonts on a text page within budget', async ({ page }) => {
    const fonts = trackFonts(page);
    await page.goto('/writing/');
    await page.evaluate(() => document.fonts.ready);
    const checks = await page.evaluate(() => [
      document.fonts.check('1.25rem "EB Garamond"'),
      document.fonts.check('600 2rem "Cormorant Garamond"'),
    ]);
    expect(checks).toEqual([true, true]);
    expect(await fonts.bytes()).toBeLessThanOrEqual(TEXT_PAGE_FONT_BUDGET);
  });

  test('keep the garden to its three font files', async ({ page }) => {
    const fonts = trackFonts(page);
    await page.goto('/?time=12:00');
    await expect(page.locator('#garden')).toHaveClass(/is-ready/);
    await page.evaluate(() => document.fonts.ready);
    expect(await fonts.bytes()).toBeLessThanOrEqual(GARDEN_FONT_BUDGET);
    expect(fonts.urls.some((u) => /eb-garamond-latin-(400-italic|600)/.test(u))).toBe(false);
  });
});

test('does not ship the style guide', async ({ page }) => {
  const res = await page.goto('/styleguide/');
  expect(res?.status()).toBe(404);
});

test.describe('first article', () => {
  const PATH = '/writing/memorylessness/';
  const TITLE = 'What makes memorylessness?';

  test('is listed on the writing page', async ({ page }) => {
    await page.goto('/writing/');
    const link = page.locator(`#content a[href="${PATH}"]`);
    await expect(link).toHaveText(TITLE);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  });

  test('renders in the shell under Writing with its title', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(PATH);
    await expect(page).toHaveTitle(`${TITLE} — Cory Wu`);
    await expect(page.locator('#content h1')).toHaveText(TITLE);
    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText('Writing');
    await expect(page.locator('script')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
