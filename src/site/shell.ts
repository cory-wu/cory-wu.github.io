/**
 * Pure helpers that wrap a text page in the site shell (skip link, top bar, footer).
 * Used at build time by the Vite plugin in vite.config.ts, so no DOM: string operations only.
 */
export type Section = 'garden' | 'writing';

export interface ShellParts {
  head: string;
  header: string;
  footer: string;
}

export interface InjectOptions extends ShellParts {
  section: Section | null;
  year: number;
}

const SHELLED = 'class="site-bar"';
const MAIN_CONTENT = /<main\b[^>]*\bid=["']content["']/;

/** The section a page belongs to; the garden (`/`) is never shelled, so it maps to null. */
export function sectionFromPath(path: string): Section | null {
  return /^\/writing(\/|$)/.test(path) ? 'writing' : null;
}

function block(snippet: string, name: string): string {
  const open = `<!-- shell:${name} -->`;
  const close = `<!-- /shell:${name} -->`;
  const start = snippet.indexOf(open);
  const end = snippet.indexOf(close);
  if (start < 0 || end < start) throw new Error(`shell.html is missing its ${name} block (${open} … ${close})`);
  return snippet.slice(start + open.length, end).trim();
}

export function splitShell(snippet: string): ShellParts {
  return { head: block(snippet, 'head'), header: block(snippet, 'header'), footer: block(snippet, 'footer') };
}

export function injectShell(html: string, opts: InjectOptions): string {
  if (html.includes(SHELLED)) return html;
  if (!MAIN_CONTENT.test(html)) throw new Error('A shelled page needs <main id="content"> for the skip link to target');

  const header = opts.section
    ? opts.header.replace(`data-section="${opts.section}"`, `data-section="${opts.section}" aria-current="page"`)
    : opts.header;
  const footer = opts.footer.replace('{{year}}', String(opts.year));

  return html
    .replace(/<\/head>/, () => `${opts.head}\n</head>`)
    .replace(/<body\b[^>]*>/, (open) => `${open}\n${header}\n`)
    .replace(/<\/body>/, `${footer}\n</body>`);
}
