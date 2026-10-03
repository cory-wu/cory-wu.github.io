import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { collectErrors } from './helpers';

const ESSAY = '/writing/memorylessness/';
const ESSAY_TITLE = 'What makes memorylessness?';
const GUIDE = '/writing/markdown-field-guide/';
const GUIDE_TITLE = "A field guide to this site's markdown";
const PHONE_WIDTH = 390;

/**
 * Records stylesheets that carry KaTeX's rules. Vite names the bundled KaTeX CSS after the page
 * entry, so it is recognised by content rather than file name.
 */
function trackKatexCss(page: Page): { urls: () => Promise<string[]> } {
  const pending: Array<Promise<string | null>> = [];
  page.on('response', (res) => {
    if (res.request().resourceType() !== 'stylesheet') return;
    pending.push(res.text().then((css) => (css.includes('.katex{') ? res.url() : null)));
  });
  return { urls: async () => (await Promise.all(pending)).filter((u): u is string => u !== null) };
}

test.describe('generated article', () => {
  test('renders the essay from markdown in the shell, with no script and no KaTeX', async ({ page }) => {
    const errors = collectErrors(page);
    const katex = trackKatexCss(page);
    await page.goto(ESSAY);
    await expect(page).toHaveTitle(`${ESSAY_TITLE} — Cory Wu`);
    await expect(page.locator('#content h1')).toHaveText(ESSAY_TITLE);
    await expect(page.locator('#content .article-meta time')).toHaveAttribute('datetime', '2026-10-03');
    await expect(page.locator('#content em')).toHaveText('This essay is still being written.');
    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText('Writing');
    await expect(page.locator('script')).toHaveCount(0);
    expect(await katex.urls()).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('markdown field guide', () => {
  test('renders every markdown feature', async ({ page }) => {
    const errors = collectErrors(page);
    const katex = trackKatexCss(page);
    await page.goto(GUIDE);
    const main = page.locator('#content');
    await expect(page).toHaveTitle(`${GUIDE_TITLE} — Cory Wu`);
    await expect(main.locator('h1')).toHaveText(GUIDE_TITLE);
    await expect(main.locator('.tag')).toHaveText(['meta']);

    await expect(main.locator('.katex').first()).toBeVisible();
    expect(await main.locator('math').count()).toBeGreaterThan(0);
    await expect(main.locator('.katex-display')).not.toHaveCount(0);

    const code = main.locator('pre.shiki code').first();
    await expect(code).toBeVisible();
    expect(await code.locator('span[style*="color"]').count()).toBeGreaterThan(1);

    await expect(main.locator('table')).toHaveCount(1);
    await expect(main.locator('input[type="checkbox"]')).not.toHaveCount(0);

    await expect(main.locator(`a[href="${ESSAY}"]`, { hasText: ESSAY_TITLE })).toHaveCount(1);
    await expect(main.locator(`a[href="${ESSAY}"]`, { hasText: 'an aliased link' })).toHaveCount(1);
    await expect(main.locator('.wikilink-missing')).toHaveCount(0);

    const img = main.locator('img[alt="A low-poly grass block"]');
    await expect(img).toHaveAttribute('width', '160');
    await expect(img).toHaveAttribute('height', '160');
    await expect(img).toHaveAttribute('src', /^\/assets\/garden-tile-[\w-]+\.svg$/);
    expect((await page.request.get((await img.getAttribute('src'))!)).status()).toBe(200);

    await expect(main.locator('aside.callout-note')).toHaveCount(1);
    await expect(main.locator('details.callout-tip:not([open])')).toHaveCount(1);
    await expect(main.locator('details.callout-warning[open]')).toHaveCount(1);

    await expect(main.locator('.footnotes')).toHaveCount(1);
    await expect(main.locator('nav.toc')).toHaveCount(1);
    expect(await main.locator('nav.toc li').count()).toBeGreaterThanOrEqual(3);

    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText('Writing');
    await expect(page.locator('script')).toHaveCount(0);
    expect(await katex.urls()).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('does not scroll sideways on a phone', async ({ page }) => {
    await page.setViewportSize({ width: PHONE_WIDTH, height: 844 });
    await page.goto(GUIDE);
    await expect(page.locator('#content h1')).toHaveText(GUIDE_TITLE);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE_WIDTH);
  });
});

test('the writing index lists exactly the published notes, newest first', async ({ page }) => {
  await page.goto('/writing/');
  const links = page.locator('#content .post-list li > a');
  await expect(links).toHaveText([ESSAY_TITLE, GUIDE_TITLE]);
  expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual([ESSAY, GUIDE]);
});
