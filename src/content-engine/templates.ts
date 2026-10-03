import type { Note } from './vault.ts';
import type { Rendered } from './markdown.ts';
import { shouldShowToc, tocHtml } from './toc.ts';
import { escapeHtml } from './plugins/escape.ts';
import { DEFAULT_PAPER } from './schema.ts';

export { escapeHtml };

export interface PageOptions {
  dev: boolean;
}

const SITE_NAME = 'Cory Wu';
const KATEX_CSS = '/node_modules/katex/dist/katex.min.css';
const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });

/** "2026-10-03" -> "3 October 2026". */
export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(`${iso}T00:00:00Z`));
}

function themeStyle(theme: Note['frontmatter']['theme']): string {
  const parts: string[] = [];
  if (theme?.accent) parts.push(`--accent:${theme.accent}`);
  if (theme?.paper) parts.push(`--paper:${theme.paper}`);
  if (theme?.headingFont) parts.push(`--heading-font:var(--font-${theme.headingFont})`);
  return parts.join(';');
}

interface DocumentParts {
  title: string;
  description?: string;
  themeColor: string;
  hasMath: boolean;
  bodyAttrs: string;
  main: string;
}

function document(p: DocumentParts): string {
  const description = p.description
    ? `\n    <meta name="description" content="${escapeHtml(p.description)}" />`
    : '';
  const katex = p.hasMath ? `\n    <link rel="stylesheet" href="${KATEX_CSS}" />` : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />${description}
    <meta name="theme-color" content="${escapeHtml(p.themeColor)}" />
    <title>${escapeHtml(p.title)} — ${SITE_NAME}</title>
    <link rel="stylesheet" href="/src/styles/site.css" />${katex}
  </head>
  <body${p.bodyAttrs}>
    <main id="content" class="prose site-column" tabindex="-1">
${p.main}
    </main>
  </body>
</html>
`;
}

function bodyAttrs(style: string, dev: boolean): string {
  return `${dev ? ' data-dev' : ''}${style ? ` style="${escapeHtml(style)}"` : ''}`;
}

const timeTag = (iso: string): string => `<time datetime="${escapeHtml(iso)}">${formatDate(iso)}</time>`;

export function articlePage(note: Note, rendered: Rendered, opts: PageOptions): string {
  const fm = note.frontmatter;
  const tags = fm.tags.map((t) => ` <span class="tag">${escapeHtml(t)}</span>`).join('');
  const badge = opts.dev && fm.draft ? ' <span class="draft-badge">Draft</span>' : '';
  const toc = shouldShowToc(rendered.headings, fm.toc) ? `\n${tocHtml(rendered.headings)}` : '';
  const main = `<header class="article-header"><h1>${escapeHtml(fm.title)}</h1><p class="article-meta">${timeTag(fm.date)}${tags}${badge}</p></header>${toc}
${rendered.html}`;
  return document({
    title: fm.title,
    description: fm.description,
    themeColor: fm.theme?.paper ?? DEFAULT_PAPER,
    hasMath: rendered.hasMath,
    bodyAttrs: bodyAttrs(themeStyle(fm.theme), opts.dev),
    main,
  });
}

export function writingIndex(notes: Note[], opts: PageOptions): string {
  const sorted = [...notes].sort((a, b) => b.frontmatter.date.localeCompare(a.frontmatter.date));
  const items = sorted.map((n) => {
    const fm = n.frontmatter;
    const desc = fm.description ? `<p>${escapeHtml(fm.description)}</p>` : '';
    return `<li><a href="/writing/${escapeHtml(n.slug)}/">${escapeHtml(fm.title)}</a>${timeTag(fm.date)}${desc}</li>`;
  });
  const list = items.length > 0 ? `<ol class="post-list">${items.join('')}</ol>` : '<p>Nothing published yet.</p>';
  return document({
    title: 'Writing',
    description: 'Writing by Cory Wu.',
    themeColor: DEFAULT_PAPER,
    hasMath: false,
    bodyAttrs: bodyAttrs('', opts.dev),
    main: `<h1>Writing</h1>\n${list}`,
  });
}
