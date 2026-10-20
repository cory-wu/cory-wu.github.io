/**
 * Off-site landmark links. Landmarks link to internal paths by default; an
 * absolute https URL is allowed only when listed here, so a typo or stray link
 * fails validation instead of shipping. See
 * docs/decisions/2026-10-20-external-landmark-links.md.
 */
export const APPROVED_EXTERNAL_HREFS: ReadonlySet<string> = new Set(['https://cal.com/cory-wu-upqzhi/15min']);

/** True for absolute https URLs (which open in a new tab). */
export function isExternalHref(href: string): boolean {
  return href.startsWith('https://');
}

/** The accessible name for a nav link; external links announce the new tab. */
export function linkLabel(label: string, href: string): string {
  return isExternalHref(href) ? `${label} (opens in a new tab)` : label;
}

export const NEW_TAB_REL = 'noopener noreferrer';

/** Follows a landmark link: external ones in a new tab, internal ones in place. */
export function openHref(win: Pick<Window, 'open'> & { location: Pick<Location, 'assign'> }, href: string): void {
  if (isExternalHref(href)) win.open(href, '_blank', 'noopener,noreferrer');
  else win.location.assign(href);
}
