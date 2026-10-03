// @vitest-environment node
import { resolve } from 'node:path';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified, type Plugin } from 'unified';
import { describe, expect, it } from 'vitest';
import { ContentError } from '../../src/content-engine/errors.ts';
import { remarkCallouts } from '../../src/content-engine/plugins/callouts.ts';
import { remarkEmbeds } from '../../src/content-engine/plugins/embeds.ts';
import { buildLinkIndex, remarkWikilinks } from '../../src/content-engine/plugins/wikilinks.ts';
import { loadVault } from '../../src/content-engine/vault.ts';

const FILE = 'src/content/writing/test.md';
const root = resolve(process.cwd(), 'tests/fixtures/vault');
const links = buildLinkIndex(loadVault('tests/fixtures/vault', { includeDrafts: true }));
const attachmentsDir = resolve(root, 'attachments');

function render(md: string, ...plugins: [Plugin<any[], any>, ...unknown[]][]): string {
  const p = unified().use(remarkParse);
  for (const [plugin, ...args] of plugins) p.use(plugin, ...args);
  return String(
    p.use(remarkRehype, { allowDangerousHtml: true }).use(rehypeStringify, { allowDangerousHtml: true }).processSync(md),
  );
}

function wiki(md: string, dev = false) {
  const warnings: string[] = [];
  const html = render(md, [remarkWikilinks, { links, dev, warn: (m: string) => warnings.push(m), file: FILE }]);
  return { html, warnings };
}

function embed(md: string) {
  const warnings: string[] = [];
  const html = render(md, [
    remarkEmbeds,
    { attachmentsDir, links, dev: false, warn: (m: string) => warnings.push(m), file: FILE },
  ]);
  return { html, warnings };
}

function callout(md: string) {
  const warnings: string[] = [];
  const html = render(md, [remarkCallouts, { warn: (m: string) => warnings.push(m), file: FILE }]);
  return { html, warnings };
}

describe('remarkWikilinks', () => {
  it('links by name, case-insensitively, with the target title', () => {
    expect(wiki('[[gamma]]').html).toBe('<p><a href="/writing/gamma/">Gamma</a></p>');
  });
  it('uses custom text', () => {
    expect(wiki('[[GAMMA|see this]]').html).toContain('<a href="/writing/gamma/">see this</a>');
  });
  it('maps headings to slugger ids', () => {
    expect(wiki('[[gamma#Some Heading]]').html).toContain(
      '<a href="/writing/gamma/#some-heading">Gamma › Some Heading</a>',
    );
  });
  it('handles several links mid-sentence', () => {
    const { html } = wiki('a [[gamma]] b [[alpha]] c');
    expect(html).toMatch(/^<p>a <a [^>]+>Gamma<\/a> b <a [^>]+>.*<\/a> c<\/p>$/);
  });
  it('renders drafts as missing in production with one warning', () => {
    const { html, warnings } = wiki('[[Beta Note]]');
    expect(html).toContain('<span class="wikilink-missing">Beta Note</span>');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(FILE);
  });
  it('links drafts in dev', () => {
    const { html, warnings } = wiki('[[Beta Note]]', true);
    expect(html).toContain('<a href="/writing/beta-note/">');
    expect(warnings).toHaveLength(0);
  });
  it('renders unknown targets as missing and warns with the name', () => {
    const { html, warnings } = wiki('[[nope]]');
    expect(html).toContain('<span class="wikilink-missing">nope</span>');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('nope');
  });
  it('leaves inline code and embeds alone', () => {
    expect(wiki('`[[gamma]]`').html).toBe('<p><code>[[gamma]]</code></p>');
    expect(wiki('![[pixel.png]]').html).toBe('<p>![[pixel.png]]</p>');
  });
  it('resolves names with punctuation to the slugified url', () => {
    const odd = buildLinkIndex([
      {
        file: 'x.md',
        name: "What's New? (2026)",
        slug: 'whats-new-2026',
        frontmatter: { title: 'New', draft: false },
        body: '',
      } as never,
    ]);
    const html = render("[[What's New? (2026)]]", [
      remarkWikilinks,
      { links: odd, dev: false, warn: () => {}, file: FILE },
    ]);
    expect(html).toContain('href="/writing/whats-new-2026/"');
  });
});

describe('remarkEmbeds', () => {
  const img = (attrs: string) =>
    `<p><img src="/src/content/attachments/pixel.png" ${attrs} loading="lazy" decoding="async"></p>`;
  it('embeds with intrinsic size and empty alt', () => {
    expect(embed('![[pixel.png]]').html).toBe(img('alt="" width="3" height="2"'));
  });
  it('takes alt text', () => {
    expect(embed('![[pixel.png|A pixel]]').html).toBe(img('alt="A pixel" width="3" height="2"'));
  });
  it('scales to a given width', () => {
    expect(embed('![[pixel.png|30]]').html).toBe(img('alt="" width="30" height="20"'));
  });
  it('takes alt and width', () => {
    expect(embed('![[pixel.png|A pixel|30]]').html).toBe(img('alt="A pixel" width="30" height="20"'));
  });
  it('throws ContentError for a missing image', () => {
    expect(() => embed('![[missing.png]]')).toThrow(ContentError);
    expect(() => embed('![[missing.png]]')).toThrow(/missing\.png/);
  });
  it('rejects path traversal', () => {
    expect(() => embed('![[../writing/x.png]]')).toThrow(ContentError);
  });
  it('treats non-image targets as a wikilink and warns', () => {
    const { html, warnings } = embed('![[gamma]]');
    expect(html).toContain('<a href="/writing/gamma/">Gamma</a>');
    expect(warnings).toHaveLength(1);
  });
  it('escapes alt text', () => {
    const { html } = embed('![[pixel.png|a "<>&" c]]');
    expect(html).toContain('alt="a &quot;&lt;&gt;&amp;&quot; c"');
  });
  it('handles text around several embeds', () => {
    const { html } = embed('x ![[pixel.png]] y ![[pixel.png|30]] z');
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).toMatch(/^<p>x <img.*> y <img.*> z<\/p>$/);
  });
});

describe('remarkCallouts', () => {
  it.each(['note', 'tip', 'warning', 'danger', 'quote', 'example'])('renders %s with a default title', (type) => {
    const { html, warnings } = callout(`> [!${type}]\n> Body`);
    expect(html).toContain(`<div class="callout callout-${type}" role="note">`);
    expect(html).toContain(`<p class="callout-title">${type[0].toUpperCase()}${type.slice(1)}</p>`);
    expect(html).toContain('<p>Body</p>');
    expect(warnings).toHaveLength(0);
  });
  it('uses a custom title', () => {
    expect(callout('> [!tip] Custom\n> Body').html).toContain('<p class="callout-title">Custom</p>');
  });
  it('falls back to note for unknown types and warns', () => {
    const { html, warnings } = callout('> [!mystery]\n> Body');
    expect(html).toContain('callout-note');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('mystery');
  });
  it('folds closed with -', () => {
    const { html } = callout('> [!note]- Fold\n> Body');
    expect(html).toContain('<details class="callout callout-note">');
    expect(html).toContain('<summary class="callout-title">Fold</summary>');
  });
  it('folds open with +', () => {
    expect(callout('> [!note]+ Fold\n> Body').html).toMatch(/<details class="callout callout-note" open>/);
  });
  it('renders body markdown', () => {
    expect(callout('> [!note]\n> **bold** text').html).toContain('<strong>bold</strong>');
  });
  it('leaves ordinary blockquotes alone', () => {
    expect(callout('> just a quote').html).toContain('<blockquote>');
  });
});
