// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ContentError } from '../../src/content-engine/errors.ts';
import { slugify } from '../../src/content-engine/slug.ts';
import { parseFrontmatter } from '../../src/content-engine/schema.ts';

function problemsOf(data: unknown): string[] {
  try {
    parseFrontmatter(data, 'f.md');
  } catch (e) {
    expect(e).toBeInstanceOf(ContentError);
    return (e as ContentError).message.split('\n');
  }
  throw new Error('expected parseFrontmatter to throw');
}

describe('ContentError', () => {
  it('prefixes each problem with the file and exposes file and problems', () => {
    const err = new ContentError('a.md', ['x: bad', 'y: worse']);
    expect(err.message).toBe('a.md: x: bad\na.md: y: worse');
    expect(err.file).toBe('a.md');
    expect(err.problems).toEqual(['x: bad', 'y: worse']);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('slugify', () => {
  it.each([
    ['memorylessness', 'memorylessness'],
    ['What Makes Memorylessness', 'what-makes-memorylessness'],
    ["What's New? (2026)", 'whats-new-2026'],
    ['  a  --  b  ', 'a-b'],
    ['???', ''],
  ])('%j -> %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('parseFrontmatter', () => {
  it('fills defaults for a minimal valid object', () => {
    expect(parseFrontmatter({ title: 'T', date: '2026-10-03' }, 'f.md')).toEqual({
      title: 'T',
      date: '2026-10-03',
      tags: [],
      draft: false,
    });
  });

  it('normalises a JS Date to YYYY-MM-DD in UTC', () => {
    const fm = parseFrontmatter({ title: 'T', date: new Date('2026-10-03T00:00:00Z') }, 'f.md');
    expect(fm.date).toBe('2026-10-03');
  });

  it('rejects impossible calendar dates', () => {
    expect(problemsOf({ title: 'T', date: '2026-02-30' })).toEqual([
      expect.stringMatching(/^f\.md: date: /),
    ]);
  });

  it('reports missing title and bad date together', () => {
    const lines = problemsOf({ date: 'soon' });
    expect(lines).toHaveLength(2);
    expect(lines.some((l) => l.startsWith('f.md: title: '))).toBe(true);
    expect(lines.some((l) => l.startsWith('f.md: date: '))).toBe(true);
  });

  it('ignores and strips unknown keys', () => {
    const fm = parseFrontmatter(
      { title: 'T', date: '2026-10-03', aliases: ['x'], cssclasses: ['y'] },
      'f.md',
    );
    expect(fm).not.toHaveProperty('aliases');
    expect(fm).not.toHaveProperty('cssclasses');
  });

  it('accepts a passing theme', () => {
    const fm = parseFrontmatter(
      { title: 'T', date: '2026-10-03', theme: { accent: '#1f4d2b', headingFont: 'ui' } },
      'f.md',
    );
    expect(fm.theme).toEqual({ accent: '#1f4d2b', headingFont: 'ui' });
  });

  it('rejects a low-contrast accent against the default paper', () => {
    expect(problemsOf({ title: 'T', date: '2026-10-03', theme: { accent: '#b0c4b1' } })).toEqual([
      'f.md: theme.accent: #b0c4b1 is 1.6:1 on #f4f1e8, needs 4.5:1',
    ]);
  });

  it('names each ink that fails on a dark paper', () => {
    const lines = problemsOf({ title: 'T', date: '2026-10-03', theme: { paper: '#777777' } });
    expect(lines).toEqual([
      'f.md: theme.paper: --ink #1f2a1f is 3.3:1 on #777777, needs 4.5:1',
      'f.md: theme.paper: --ink-soft #4a564a is 1.7:1 on #777777, needs 4.5:1',
      'f.md: theme.paper: --ink-muted #677067 is 1.1:1 on #777777, needs 4.5:1',
    ]);
  });

  it('lists only the inks that fail on a mid-tone paper', () => {
    const lines = problemsOf({ title: 'T', date: '2026-10-03', theme: { paper: '#e0e0e0' } });
    expect(lines).toEqual([expect.stringContaining('--ink-muted #677067 is 3.9:1 on #e0e0e0')]);
  });

  it('checks the accent against a custom paper', () => {
    const lines = problemsOf({
      title: 'T',
      date: '2026-10-03',
      theme: { paper: '#ffffff', accent: '#cccccc' },
    });
    expect(lines).toEqual([expect.stringMatching(/^f\.md: theme\.accent: #cccccc is [\d.]+:1 on #ffffff, needs 4\.5:1$/)]);
  });

  it('rejects an unknown headingFont and a non-boolean toc', () => {
    expect(problemsOf({ title: 'T', date: '2026-10-03', theme: { headingFont: 'serif' } })[0]).toMatch(
      /^f\.md: theme\.headingFont: /,
    );
    expect(problemsOf({ title: 'T', date: '2026-10-03', toc: 'yes' })[0]).toMatch(/^f\.md: toc: /);
  });

  it('rejects non-object input', () => {
    expect(problemsOf(null)).toHaveLength(1);
  });
});
