import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import { writingIndex } from '../../src/content-engine/templates';

const ICONS = [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', type: null },
] as const;

const publicFile = (href: string) => resolve(import.meta.dirname, '../../public', href.slice(1));
const head = (html: string) => new DOMParser().parseFromString(html, 'text/html').head;

describe('site icons', () => {
  for (const [page, html] of [
    ['garden', indexHtml],
    ['writing pages', writingIndex([], { dev: false })],
  ] as const) {
    it(`are linked from the ${page} head`, () => {
      for (const { rel, href, type } of ICONS) {
        const link = head(html).querySelector(`link[rel="${rel}"]`);
        expect(link?.getAttribute('href'), rel).toBe(href);
        expect(link?.getAttribute('type') ?? null, rel).toBe(type);
      }
    });
  }

  it('exist in public/', () => {
    for (const { href } of ICONS) expect(existsSync(publicFile(href)), href).toBe(true);
  });

  it('replace the Vite default with the CW monogram on paper', () => {
    const svg = readFileSync(publicFile('/favicon.svg'), 'utf8');
    expect(svg).not.toContain('#863bff');
    expect(svg).toContain('#f4f1e8');
    expect(svg).toContain('#2f6b3a');
  });
});
