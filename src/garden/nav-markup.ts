import type { Placement } from './landmarks/types';

/** The empty nav list in index.html that the build fills with landmark links. */
const EMPTY_NAV_LIST = /(<ul id="site-nav-list">)\s*(<\/ul>)/;

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/**
 * Writes one `<li><a>` per placement into the page's empty `#site-nav-list`,
 * so the nav works before (and without) JavaScript. Pages without that empty
 * list are returned unchanged.
 */
export function injectNavLinks(html: string, ps: Placement[]): string {
  const items = ps
    .map(({ landmark: { id, href, label } }) => {
      return `<li><a href="${escapeHtml(href)}" data-landmark-id="${escapeHtml(id)}">${escapeHtml(label)}</a></li>`;
    })
    .join('');
  return html.replace(EMPTY_NAV_LIST, (_match, open: string, close: string) => `${open}${items}${close}`);
}
