import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { meetsAA } from '../../src/site/contrast';

// Vitest hands CSS `?raw` imports back as empty strings, so read the files from disk.
export function readStyle(name: string): string {
  // Vitest runs from the project root; jsdom's URL class doesn't satisfy node:fs, so use a path.
  return readFileSync(resolve(process.cwd(), 'src/styles', name), 'utf8');
}

/** `--name: value` pairs declared anywhere in the stylesheet (tokens live on :root). */
export function parseTokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const usedVars = (css: string): Set<string> =>
  new Set([...withoutComments(css).matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));

const tokens = parseTokens(readStyle('tokens.css'));
const token = (name: string): string => {
  const v = tokens.get(name);
  if (v === undefined) throw new Error(`${name} is not defined in tokens.css`);
  return v;
};

describe('colour tokens', () => {
  it('match the spec exactly', () => {
    expect(Object.fromEntries(
      ['--paper', '--paper-raised', '--ink', '--ink-soft', '--ink-muted', '--accent', '--accent-2', '--rule'].map((n) => [n, token(n)]),
    )).toEqual({
      '--paper': '#f4f1e8',
      '--paper-raised': '#fbf8f0',
      '--ink': '#1f2a1f',
      '--ink-soft': '#4a564a',
      '--ink-muted': '#677067',
      '--accent': '#2f6b3a',
      '--accent-2': '#c8683f',
      '--rule': 'rgba(31, 42, 31, 0.14)',
    });
  });

  it('keep every text colour at WCAG AA on both papers', () => {
    for (const ink of ['--ink', '--ink-soft', '--ink-muted']) {
      for (const paper of ['--paper', '--paper-raised']) {
        expect(meetsAA(token(ink), token(paper)), `${ink} on ${paper}`).toBe(true);
      }
    }
    expect(meetsAA(token('--accent'), token('--paper')), '--accent on --paper').toBe(true);
  });
});

describe('type and spacing tokens', () => {
  it('define the font stacks, scale and measure', () => {
    expect(token('--font-display')).toBe("'Cormorant Garamond', 'EB Garamond', Georgia, serif");
    expect(token('--font-text')).toBe("'EB Garamond', Georgia, serif");
    expect(token('--font-ui')).toBe("Inter, system-ui, -apple-system, 'Segoe UI', sans-serif");
    expect(token('--font-mono')).toBe('ui-monospace, SFMono-Regular, Menlo, Consolas, monospace');
    expect(token('--heading-font')).toBe('var(--font-display)');
    expect(token('--text-body')).toBe('1.25rem');
    expect(token('--text-h1')).toBe('clamp(2.4rem, 5vw, 3.2rem)');
    expect(token('--text-h2')).toBe('2rem');
    expect(token('--text-h3')).toBe('1.5rem');
    expect(token('--text-ui')).toBe('0.875rem');
    expect(token('--text-label')).toBe('0.8125rem');
    expect(token('--measure')).toBe('34em');
  });

  it('define the spacing scale', () => {
    const scale = ['0.25rem', '0.5rem', '0.75rem', '1rem', '1.5rem', '2rem', '3rem', '4rem'];
    scale.forEach((v, i) => expect(token(`--space-${i + 1}`)).toBe(v));
  });
});

describe('stylesheets', () => {
  it('only use variables that tokens.css defines', () => {
    for (const file of ['base.css', 'prose.css', 'shell.css']) {
      const missing = [...usedVars(readStyle(file))].filter((v) => !tokens.has(v));
      expect(missing, file).toEqual([]);
    }
  });

  it('lets the garden use only tokens or its own local properties', () => {
    const garden = readStyle('garden.css');
    const local = parseTokens(garden);
    const missing = [...usedVars(garden)].filter((v) => !tokens.has(v) && !local.has(v));
    expect(missing).toEqual([]);
  });

  it('pulls the garden onto the shared fonts and tokens', () => {
    const imports = [...readStyle('garden.css').matchAll(/@import\s+['"]\.\/([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports).toEqual(['fonts.css', 'tokens.css']);
  });

  it('load exactly the six font files the spec lists', () => {
    const imports = [...readStyle('fonts.css').matchAll(/@import\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual([
      '@fontsource/cormorant-garamond/latin-500.css',
      '@fontsource/cormorant-garamond/latin-600.css',
      '@fontsource/eb-garamond/latin-400-italic.css',
      '@fontsource/eb-garamond/latin-400.css',
      '@fontsource/eb-garamond/latin-600.css',
      '@fontsource/inter/latin-500.css',
    ]);
  });

  it('bundles fonts, tokens, base, prose and shell in order in site.css', () => {
    const imports = [...readStyle('site.css').matchAll(/@import\s+['"]\.\/([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports).toEqual(['fonts.css', 'tokens.css', 'base.css', 'prose.css', 'shell.css']);
  });
});

/**
 * Readability rules, checked per rule block. Limits: only blocks that set both a family and a
 * size are judged, and sizes are read from `font-size` or the `font` shorthand in that block.
 */
describe('readability rules', () => {
  const BIG = new Set(['var(--text-h1)', 'var(--text-h2)', 'var(--text-h3)']);
  const SMALL = new Set(['var(--text-label)']); // --text-ui is exactly 0.875rem, the floor itself

  function blocks(css: string): Array<{ selector: string; body: string }> {
    return [...withoutComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
  }
  function family(body: string): string | null {
    const m = body.match(/font(?:-family)?\s*:[^;]*var\((--font-display|--heading-font|--font-text|--font-ui|--font-mono)\)/);
    return m ? m[1] : null;
  }
  function size(body: string): string | null {
    const fs = body.match(/font-size\s*:\s*([^;]+);/);
    if (fs) return fs[1].trim();
    const shorthand = body.match(/font\s*:\s*(?:\d{3}\s+)?(var\(--text-[\w-]+\)|[\d.]+rem)/);
    return shorthand ? shorthand[1] : null;
  }
  const rem = (v: string): number | null => (/^[\d.]+rem$/.test(v) ? parseFloat(v) : null);

  for (const file of ['prose.css', 'shell.css']) {
    it(`${file}: Cormorant/heading font only at 1.5rem and up`, () => {
      for (const { selector, body } of blocks(readStyle(file))) {
        const f = family(body);
        const s = size(body);
        if (!s || (f !== '--font-display' && f !== '--heading-font')) continue;
        const ok = BIG.has(s) || (rem(s) ?? 0) >= 1.5;
        expect(ok, `${selector} sets ${f} at ${s}`).toBe(true);
      }
    });

    it(`${file}: no serif below 0.875rem`, () => {
      for (const { selector, body } of blocks(readStyle(file))) {
        const f = family(body);
        const s = size(body);
        if (!s || !f || f === '--font-ui' || f === '--font-mono') continue;
        const small = SMALL.has(s) || (rem(s) !== null && rem(s)! < 0.875);
        expect(small, `${selector} sets ${f} at ${s}`).toBe(false);
      }
    });
  }
});

describe('style guide sample themes', () => {
  // These are the two non-default themes shown in styleguide/index.html.
  const THEMES = [
    { accent: '#9a4a2a', paper: '#f8f1e6' },
    { accent: '#3d5a73', paper: '#eef1f2' },
  ];

  it('keep their accent and every ink at AA on their paper', () => {
    for (const { accent, paper } of THEMES) {
      expect(meetsAA(accent, paper), `${accent} on ${paper}`).toBe(true);
      for (const ink of ['--ink', '--ink-soft', '--ink-muted']) {
        expect(meetsAA(token(ink), paper), `${ink} on ${paper}`).toBe(true);
      }
    }
  });

  it('are the themes the style guide actually uses', () => {
    const guide = readFileSync(resolve(process.cwd(), 'styleguide/index.html'), 'utf8');
    for (const { accent, paper } of THEMES) {
      expect(guide).toContain(`--accent: ${accent}`);
      expect(guide).toContain(`--paper: ${paper}`);
    }
  });
});
