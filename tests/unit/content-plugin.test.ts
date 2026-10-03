// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { UserConfig } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentError } from '../../src/content-engine/errors.ts';
import { contentEngine, loadContent, pageIdsFor, renderPage } from '../../src/content-engine/plugin.ts';
import { buildLinkIndex } from '../../src/content-engine/plugins/wikilinks.ts';
import { loadVault } from '../../src/content-engine/vault.ts';

const VAULT = 'tests/fixtures/vault';
const temps: string[] = [];

function tempDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'content-plugin-'));
  temps.push(root);
  return root;
}

afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

function ctx(dev: boolean) {
  const notes = loadVault(VAULT, { includeDrafts: true });
  return { notes, links: buildLinkIndex(notes), contentDir: VAULT, dev, warn: () => {} };
}

describe('pageIdsFor', () => {
  it('lists the index and each published note', () => {
    const notes = loadVault(VAULT, { includeDrafts: true });
    expect(pageIdsFor(notes)).toEqual([
      'writing/index.html',
      'writing/gamma/index.html',
      'writing/alpha/index.html',
      'writing/crlf/index.html',
    ]);
  });
});

describe('renderPage', () => {
  it('renders the index for /writing and /writing/', async () => {
    for (const url of ['/writing', '/writing/', '/writing/index.html']) {
      const html = await renderPage(url, ctx(false));
      expect(html, url).toContain('<h1>Writing</h1>');
      expect(html, url).toContain('href="/writing/gamma/"');
      expect(html, url).not.toContain('href="/writing/beta-note/"');
    }
  });

  it('renders an article for every URL form', async () => {
    for (const url of ['/writing/gamma', '/writing/gamma/', '/writing/gamma/index.html']) {
      const html = await renderPage(url, ctx(false));
      expect(html, url).toContain('<h1>Gamma</h1>');
      expect(html, url).toContain('<main id="content"');
    }
  });

  it('ignores query strings and hashes', async () => {
    expect(await renderPage('/writing/gamma/?x=1#top', ctx(false))).toContain('<h1>Gamma</h1>');
  });

  it('returns null for unknown URLs', async () => {
    expect(await renderPage('/writing/nope/', ctx(false))).toBeNull();
    expect(await renderPage('/elsewhere/', ctx(false))).toBeNull();
    expect(await renderPage('/writing/gamma/extra/', ctx(false))).toBeNull();
  });

  it('renders drafts only in dev', async () => {
    expect(await renderPage('/writing/beta-note/', ctx(true))).toContain('draft-badge');
    expect(await renderPage('/writing/', ctx(true))).toContain('href="/writing/beta-note/"');
    expect(await renderPage('/writing/beta-note/', ctx(false))).toBeNull();
  });

  it('rejects with ContentError when a note has invalid LaTeX', async () => {
    const root = tempDir();
    mkdirSync(join(root, 'writing'));
    writeFileSync(join(root, 'writing', 'bad.md'), '---\ntitle: Bad\ndate: 2026-01-01\n---\n\n$$\\frac{1$$\n');
    const notes = loadVault(root, { includeDrafts: true });
    const page = renderPage('/writing/bad/', {
      notes,
      links: buildLinkIndex(notes),
      contentDir: root,
      dev: true,
      warn: () => {},
    });
    await expect(page).rejects.toBeInstanceOf(ContentError);
  });
});

describe('loadContent', () => {
  it('throws ContentError for a note with bad frontmatter', () => {
    const root = tempDir();
    mkdirSync(join(root, 'writing'));
    writeFileSync(join(root, 'writing', 'bad.md'), '---\ndate: 2026-01-01\n---\n\nNo title.\n');
    expect(() => loadContent(root, { includeDrafts: true, warn: () => {} })).toThrow(ContentError);
  });

  it('treats a missing writing folder as an empty vault and warns', async () => {
    const root = tempDir();
    const warn = vi.fn();
    const content = loadContent(root, { includeDrafts: false, warn });
    expect(content.notes).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('writing'));
    const html = await renderPage('/writing/', { ...content, contentDir: root, dev: false, warn });
    expect(html).toContain('Nothing published yet.');
  });

  it('loads notes and their link index', () => {
    const content = loadContent(VAULT, { includeDrafts: false, warn: () => {} });
    expect(content.notes.map((n) => n.slug)).toEqual(['gamma', 'alpha', 'crlf']);
    expect(content.links.get('gamma')?.slug).toBe('gamma');
  });
});

describe('contentEngine config hook', () => {
  type ConfigHook = (config: UserConfig, env: { command: 'build' | 'serve'; mode: string }) => UserConfig | null | void;
  const configHook = (contentDir: string): ConfigHook =>
    contentEngine({ contentDir }).config as unknown as ConfigHook;

  it('adds the generated pages to the existing build inputs', () => {
    const out = configHook(VAULT)({ build: { rollupOptions: { input: { main: 'index.html' } } } }, { command: 'build', mode: 'production' });
    expect(out?.build?.rollupOptions?.input).toEqual({
      main: 'index.html',
      writing: 'writing/index.html',
      'writing/gamma': 'writing/gamma/index.html',
      'writing/alpha': 'writing/alpha/index.html',
      'writing/crlf': 'writing/crlf/index.html',
    });
  });

  it('keeps attachments as files and defers other assets to Vite', () => {
    const out = configHook(VAULT)({}, { command: 'build', mode: 'production' });
    const limit = out?.build?.assetsInlineLimit as (file: string, content: Buffer) => boolean | undefined;
    expect(limit(resolve(VAULT, 'attachments/pixel.png'), Buffer.alloc(10))).toBe(false);
    expect(limit(resolve('src/garden/x.png'), Buffer.alloc(10))).toBeUndefined();
  });

  it('adds nothing when serving', () => {
    expect(configHook(VAULT)({}, { command: 'serve', mode: 'development' })).toBeUndefined();
  });
});
