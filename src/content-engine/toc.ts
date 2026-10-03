import { escapeHtml } from './plugins/escape.ts';

export interface Heading {
  depth: 2 | 3 | 4;
  id: string;
  text: string;
}

const MIN_TOC_HEADINGS = 3;

/** `override` (frontmatter `toc`) wins; otherwise show with at least 3 h2/h3 headings. */
export function shouldShowToc(headings: Heading[], override?: boolean): boolean {
  if (override !== undefined) return override;
  return headings.filter((h) => h.depth === 2 || h.depth === 3).length >= MIN_TOC_HEADINGS;
}

function link(h: Heading): string {
  return `<a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>`;
}

/** `<nav class="toc">` of h2 entries with nested h3 entries; h4 is excluded. */
export function tocHtml(headings: Heading[]): string {
  const items: string[] = [];
  let open = false; // an h2 <li> is currently open
  let nested = false; // its inner <ol> is open
  const closeH2 = (): void => {
    if (nested) items.push('</ol>');
    if (open) items.push('</li>');
    open = false;
    nested = false;
  };
  for (const h of headings) {
    if (h.depth === 2) {
      closeH2();
      items.push(`<li>${link(h)}`);
      open = true;
    } else if (h.depth === 3) {
      if (!open) {
        items.push('<li>');
        open = true;
      }
      if (!nested) {
        items.push('<ol>');
        nested = true;
      }
      items.push(`<li>${link(h)}</li>`);
    }
  }
  closeH2();
  return `<nav class="toc" aria-label="Contents"><ol>${items.join('')}</ol></nav>`;
}
