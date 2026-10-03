// @vitest-environment node
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ContentError } from '../../src/content-engine/errors.ts';
import { renderNote, type RenderContext } from '../../src/content-engine/markdown.ts';
import { buildLinkIndex } from '../../src/content-engine/plugins/wikilinks.ts';
import { shouldShowToc, tocHtml, type Heading } from '../../src/content-engine/toc.ts';
import { loadVault, type Note } from '../../src/content-engine/vault.ts';

const FILE = 'src/content/writing/test.md';
const links = buildLinkIndex(loadVault('tests/fixtures/vault', { includeDrafts: true }));
const attachmentsDir = resolve(process.cwd(), 'tests/fixtures/vault/attachments');

function note(body: string): Note {
  return {
    file: FILE,
    name: 'test',
    slug: 'test',
    frontmatter: { title: 'Test', date: '2026-01-01', draft: false } as Note['frontmatter'],
    body,
  };
}

function ctx(forwarded: string[] = []): RenderContext {
  return { links, attachmentsDir, dev: false, warn: (m) => forwarded.push(m) };
}

const render = (body: string, forwarded?: string[]) => renderNote(note(body), ctx(forwarded));

// Warm the Shiki highlighter so the first test does not absorb its start-up cost.
beforeAll(async () => {
  await render('```ts\nconst warm = 1\n```');
}, 30_000);

describe('renderNote', () => {
  it('renders inline math with KaTeX and reports hasMath', async () => {
    const r = await render('$e^{i\\pi}+1=0$');
    expect(r.html).toContain('class="katex"');
    expect(r.html).toContain('<math');
    expect(r.hasMath).toBe(true);
    expect((await render('plain text')).hasMath).toBe(false);
  });

  it('throws a ContentError naming the invalid expression', async () => {
    const err = await render('$$\\frac{1}{$$').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ContentError);
    expect((err as ContentError).message).toContain('invalid LaTeX');
    expect((err as ContentError).message).toContain('\\frac{1}{');
    expect((err as ContentError).file).toBe(FILE);
  });

  it('highlights known languages with Shiki', async () => {
    const r = await render('```ts\nconst x: number = 1\n```');
    expect(r.html).toContain('class="shiki');
    expect(r.html).toContain('<span style=');
  });

  it('falls back to text and warns for unknown languages', async () => {
    const forwarded: string[] = [];
    const r = await render('```madeuplang\nhello\n```', forwarded);
    expect(r.html).toContain('hello');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toBe(`${FILE}: unknown code language "madeuplang"; rendered as plain text`);
    expect(forwarded).toEqual(r.warnings);
  });

  it('renders footnotes in a Notes section', async () => {
    const r = await render('a[^1]\n\n[^1]: note');
    expect(r.html).toContain('class="footnotes"');
    expect(r.html).toMatch(/<h2[^>]*>Notes<\/h2>/);
    expect(r.html).not.toContain('heading-anchor');
    expect(r.html).not.toContain('sr-only');
    expect(r.headings).toEqual([]);
  });

  it('keeps the footnote Notes heading out of the TOC count', async () => {
    const r = await render('## A\n\n## B\n\ntext[^1]\n\n[^1]: note');
    expect(r.headings.map((h) => h.id)).toEqual(['a', 'b']);
    expect(shouldShowToc(r.headings)).toBe(false);
  });

  it('treats currency-style dollars as literal text', async () => {
    const r = await render('It costs $5 and $10 today.');
    expect(r.hasMath).toBe(false);
    expect(r.html).toContain('It costs $5 and $10 today.');
    expect(r.html).not.toContain('katex');
    const spaced = await render('$ x $');
    expect(spaced.hasMath).toBe(false);
    expect(spaced.html).toContain('$ x $');
  });

  it('still renders valid inline and display math', async () => {
    for (const src of ['$x$', '$e^{i\\pi}$', '$$\nx\n$$']) {
      const r = await render(src);
      expect(r.hasMath).toBe(true);
      expect(r.html).toContain('class="katex');
    }
  });

  it('collects headings with anchors', async () => {
    const r = await render('## A\n\n### B\n\n## C');
    expect(r.headings).toEqual([
      { depth: 2, id: 'a', text: 'A' },
      { depth: 3, id: 'b', text: 'B' },
      { depth: 2, id: 'c', text: 'C' },
    ]);
    expect(r.html.match(/class="heading-anchor"/g)).toHaveLength(3);
    expect(r.html).toContain('href="#a"');
    expect(r.html).toContain('aria-label="Link to this section"');
  });

  it('renders a wikilink and an embed in one pass', async () => {
    const r = await render('see ![[pixel.png]] and [[gamma]]');
    expect(r.html.match(/<img/g)).toHaveLength(1);
    expect(r.html).toContain('width="3" height="2"');
    expect(r.html.match(/<a href="\/writing\/gamma\/">/g)).toHaveLength(1);
  });

  it('renders callouts', async () => {
    const r = await render('> [!tip] Hint\n> body');
    expect(r.html).toContain('<aside class="callout callout-tip">');
  });
});

describe('toc', () => {
  const h = (depth: 2 | 3 | 4, id: string): Heading => ({ depth, id, text: id.toUpperCase() });

  it('shows with at least three h2/h3 headings, override wins', () => {
    const three = [h(2, 'a'), h(3, 'b'), h(2, 'c')];
    expect(shouldShowToc(three)).toBe(true);
    expect(shouldShowToc(three.slice(0, 2))).toBe(false);
    expect(shouldShowToc(three, false)).toBe(false);
    expect(shouldShowToc(three.slice(0, 1), true)).toBe(true);
    expect(shouldShowToc([h(2, 'a'), h(4, 'x'), h(4, 'y'), h(2, 'b')])).toBe(false);
  });

  it('nests h3 under h2 and drops h4', () => {
    const html = tocHtml([h(2, 'a'), h(3, 'b'), h(4, 'x'), h(2, 'c')]);
    expect(html).toBe(
      '<nav class="toc" aria-label="Contents"><ol>' +
        '<li><a href="#a">A</a><ol><li><a href="#b">B</a></li></ol></li>' +
        '<li><a href="#c">C</a></li></ol></nav>',
    );
  });
});
