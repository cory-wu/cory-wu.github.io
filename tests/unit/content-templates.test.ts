import { describe, expect, it } from 'vitest';
import type { Note } from '../../src/content-engine/vault';
import type { Rendered } from '../../src/content-engine/markdown';
import { articlePage, escapeHtml, formatDate, writingIndex } from '../../src/content-engine/templates';

function note(over: Partial<Note['frontmatter']> = {}, slug = 'a-note'): Note {
  return {
    file: `src/content/writing/${slug}.md`,
    name: slug,
    slug,
    body: '',
    frontmatter: { title: 'A note', date: '2026-10-03', tags: [], draft: false, ...over },
  };
}

const rendered = (over: Partial<Rendered> = {}): Rendered => ({
  html: '<p>Body</p>',
  headings: [],
  hasMath: false,
  warnings: [],
  ...over,
});

const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');
const heads = (n: number): Rendered['headings'] =>
  Array.from({ length: n }, (_, i) => ({ depth: 2 as const, id: `h${i}`, text: `H${i}` }));

describe('escaping', () => {
  const title = 'A <b>&</b> "Q" </title>';
  const description = 'x < y & "z"';

  it('keeps hostile frontmatter text inert in the article', () => {
    const doc = parse(articlePage(note({ title, description }), rendered(), { dev: false }));
    expect(doc.title).toBe(`${title} — Cory Wu`);
    expect(doc.querySelector('h1')?.textContent).toBe(title);
    expect(doc.querySelector('b')).toBeNull();
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(description);
  });

  it('keeps hostile titles as text in the index', () => {
    const doc = parse(writingIndex([note({ title })], { dev: false }));
    expect(doc.querySelector('.post-list a')?.textContent).toBe(title);
    expect(doc.querySelector('b')).toBeNull();
  });

  it('re-exports one escapeHtml', () => {
    expect(escapeHtml('<&>')).toBe('&lt;&amp;&gt;');
  });
});

describe('articlePage', () => {
  it('sets theme variables only for set fields, in order, and the theme-color', () => {
    const doc = parse(articlePage(
      note({ theme: { accent: '#9a4a2a', paper: '#f8f1e6', headingFont: 'text' } }), rendered(), { dev: false }));
    expect(doc.body.getAttribute('style')).toBe('--accent:#9a4a2a;--paper:#f8f1e6;--heading-font:var(--font-text)');
    expect(doc.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f8f1e6');
  });

  it('omits style and uses the default paper without a theme', () => {
    const doc = parse(articlePage(note(), rendered(), { dev: false }));
    expect(doc.body.hasAttribute('style')).toBe(false);
    expect(doc.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f4f1e8');
  });

  it('only emits set theme fields', () => {
    const doc = parse(articlePage(note({ theme: { paper: '#ffffff' } }), rendered(), { dev: false }));
    expect(doc.body.getAttribute('style')).toBe('--paper:#ffffff');
  });

  it('links KaTeX CSS iff the page has math, with the shell-ready main and no scripts', () => {
    const plain = articlePage(note(), rendered(), { dev: false });
    const math = articlePage(note(), rendered({ hasMath: true }), { dev: false });
    expect(parse(plain).querySelector('link[href*="katex"]')).toBeNull();
    expect(parse(math).querySelector('link[href*="katex"]')).not.toBeNull();
    expect(parse(plain).querySelector('link[href="/src/styles/site.css"]')).not.toBeNull();
    const main = parse(plain).querySelector('main');
    expect(main?.id).toBe('content');
    expect(main?.className).toBe('prose site-column');
    expect(main?.getAttribute('tabindex')).toBe('-1');
    expect(plain).not.toContain('<script');
    expect(math).not.toContain('<script');
  });

  it('shows data-dev and the draft badge only in dev for drafts', () => {
    const draft = note({ draft: true });
    const dev = parse(articlePage(draft, rendered(), { dev: true }));
    const prod = parse(articlePage(draft, rendered(), { dev: false }));
    const devPublished = parse(articlePage(note(), rendered(), { dev: true }));
    expect(dev.body.hasAttribute('data-dev')).toBe(true);
    expect(dev.querySelector('.draft-badge')?.textContent).toBe('Draft');
    expect(prod.body.hasAttribute('data-dev')).toBe(false);
    expect(prod.querySelector('.draft-badge')).toBeNull();
    expect(devPublished.querySelector('.draft-badge')).toBeNull();
  });

  it('renders the TOC from three headings, not two', () => {
    expect(parse(articlePage(note(), rendered({ headings: heads(3) }), { dev: false })).querySelector('nav.toc')).not.toBeNull();
    expect(parse(articlePage(note(), rendered({ headings: heads(2) }), { dev: false })).querySelector('nav.toc')).toBeNull();
  });

  it('renders the date, tags and body in order', () => {
    const doc = parse(articlePage(note({ tags: ['math', 'notes'] }), rendered(), { dev: false }));
    const time = doc.querySelector('.article-header time');
    expect(time?.getAttribute('datetime')).toBe('2026-10-03');
    expect(time?.textContent).toBe('3 October 2026');
    expect([...doc.querySelectorAll('.article-meta .tag')].map((t) => t.textContent)).toEqual(['math', 'notes']);
    expect(doc.querySelector('main > header + p')?.textContent).toBe('Body');
  });
});

describe('writingIndex', () => {
  it('lists notes newest first with links, dates and descriptions', () => {
    const doc = parse(writingIndex([
      note({ title: 'Old', date: '2026-01-02' }, 'old'),
      note({ title: 'New', date: '2026-09-01', description: 'Fresh.' }, 'new'),
    ], { dev: false }));
    const items = [...doc.querySelectorAll('ol.post-list > li')];
    expect(items.map((li) => li.querySelector('a')?.getAttribute('href'))).toEqual(['/writing/new/', '/writing/old/']);
    expect(items[0].querySelector('p')?.textContent).toBe('Fresh.');
    expect(items[0].querySelector('time')?.textContent).toBe('1 September 2026');
    expect(doc.querySelector('h1')?.textContent).toBe('Writing');
  });

  it('says so when nothing is published', () => {
    const doc = parse(writingIndex([], { dev: false }));
    expect(doc.querySelector('main')?.textContent).toContain('Nothing published yet.');
    expect(doc.querySelector('.post-list')).toBeNull();
  });

  it('marks data-dev in dev', () => {
    expect(parse(writingIndex([], { dev: true })).body.hasAttribute('data-dev')).toBe(true);
  });
});

describe('formatDate', () => {
  it('formats in UTC', () => {
    expect(formatDate('2026-10-03')).toBe('3 October 2026');
  });
});
