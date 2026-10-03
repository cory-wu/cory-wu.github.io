import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { injectShell, sectionFromPath, splitShell } from '../../src/site/shell';

const snippet = readFileSync(resolve(process.cwd(), 'src/site/shell.html'), 'utf8');
const { head, header, footer } = splitShell(snippet);
const page = '<!doctype html><html><head></head><body><main id="content" class="prose"><h1>Hi</h1></main></body></html>';
const shelled = (section: 'garden' | 'writing' | null = 'writing', html = page): Document =>
  new DOMParser().parseFromString(injectShell(html, { head, header, footer, section, year: 2026 }), 'text/html');

describe('sectionFromPath', () => {
  it('maps every writing path to the writing section', () => {
    for (const p of ['/writing', '/writing/', '/writing/index.html', '/writing/some-post/', '/writing/some-post/index.html']) {
      expect(sectionFromPath(p), p).toBe('writing');
    }
  });

  it('never shells the garden and ignores unknown sections', () => {
    for (const p of ['/', '/index.html', '/styleguide/', '/styleguide/index.html', '/writings/']) {
      expect(sectionFromPath(p), p).toBeNull();
    }
  });
});

describe('splitShell', () => {
  it('finds the header and footer blocks in the real snippet', () => {
    expect(header).toContain('class="site-bar"');
    expect(header).toContain('class="skip-link"');
    expect(footer).toContain('class="site-footer"');
  });

  it('throws when a block is missing', () => {
    expect(() => splitShell(snippet.replace('<!-- shell:footer -->', ''))).toThrow(/footer/);
    expect(() => splitShell(snippet.replace('<!-- /shell:header -->', ''))).toThrow(/header/);
    expect(() => splitShell(snippet.replace('<!-- shell:head -->', ''))).toThrow(/head/);
  });
});

describe('injectShell', () => {
  it('adds exactly one skip link, top bar and footer, skip link first and footer last', () => {
    const doc = shelled();
    expect(doc.querySelectorAll('.skip-link')).toHaveLength(1);
    expect(doc.querySelectorAll('.site-bar')).toHaveLength(1);
    expect(doc.querySelectorAll('.site-footer')).toHaveLength(1);
    expect(doc.body.firstElementChild?.className).toBe('skip-link');
    expect(doc.body.lastElementChild?.className).toBe('site-footer');
    expect(doc.querySelector('main#content h1')?.textContent).toBe('Hi');
  });

  it('marks only the current section', () => {
    const doc = shelled('writing');
    expect(doc.querySelector('[data-section="writing"]')?.getAttribute('aria-current')).toBe('page');
    expect(doc.querySelector('[data-section="garden"]')?.hasAttribute('aria-current')).toBe(false);
    expect(shelled(null).querySelectorAll('[aria-current]')).toHaveLength(0);
  });

  it('preloads the three first-paint fonts in <head>', () => {
    const hrefs = [...shelled().head.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual([
      '/node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2',
      '/node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2',
      '/node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2',
    ]);
    for (const l of shelled().head.querySelectorAll('link[rel="preload"]')) {
      expect(l.getAttribute('type')).toBe('font/woff2');
      expect(l.hasAttribute('crossorigin')).toBe(true);
    }
  });

  it('fills in the year', () => {
    const text = shelled().querySelector('.site-footer')?.textContent ?? '';
    expect(text).toContain('© 2026');
    expect(text).not.toContain('{{year}}');
  });

  it('is idempotent', () => {
    const once = injectShell(page, { head, header, footer, section: 'writing', year: 2026 });
    expect(injectShell(once, { head, header, footer, section: 'writing', year: 2026 })).toBe(once);
  });

  it('keeps attributes on <body>', () => {
    const doc = shelled('writing', page.replace('<body>', '<body class="x" style="--accent:#123456">'));
    expect(doc.body.className).toBe('x');
    expect(doc.body.getAttribute('style')).toBe('--accent:#123456');
  });

  it('refuses a page without <main id="content">', () => {
    expect(() => injectShell('<html><body><main></main></body></html>', { head, header, footer, section: null, year: 2026 })).toThrow(
      /main id="content"/,
    );
  });
});
