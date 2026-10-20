# External landmark links (allowlist, new tab)

Date: 2026-10-20
Status: Accepted

## Context

Landmarks were internal-only: `validatePlacements` rejected any href not
starting with `/`, and both a scene click and the nav link navigated the
current tab. The clock post landmark ("Meet with me") has to open the
cal.com booking page at `https://cal.com/cory-wu-upqzhi/15min`, which is
off-site.

## Decision

- **Allowlist, not a pattern.** An absolute `https://` href is valid only
  if it is listed in `APPROVED_EXTERNAL_HREFS`
  (`src/garden/landmarks/links.ts`). Unlisted `https://`, `http://` and
  protocol-relative `//` hrefs still fail validation, so a typo or stray
  link is caught by the registry test instead of shipping.
- **External links open in a new tab.** A scene click calls
  `window.open(href, '_blank', 'noopener,noreferrer')`; the nav link gets
  `target="_blank" rel="noopener noreferrer"` and the accessible name
  "<label> (opens in a new tab)" via `aria-label` (the visible text stays
  the label, so the accessible name starts with it). The garden stays
  open behind the booking page.
- **Plain link, no embed.** The page loads nothing from cal.com; the
  booking page loads only when a visitor follows the link.

## Alternatives considered

- **cal.com embed modal over the garden** — books without leaving the
  site, but loads a third-party script, needs focus management and a
  fallback for blocked scripts. Considered and dropped in favour of the
  plain link.
- **Internal `/meet/` page linking out** — keeps the `/`-only rule, but
  adds a page that exists only to hold one link.
- **Same-tab navigation** — consistent with internal landmarks, but the
  visitor leaves the garden for a third-party site.

## Consequences

Adding another off-site landmark means adding its URL to the allowlist
on purpose. The e2e suite stubs `https://cal.com/**` so tests stay
offline.
