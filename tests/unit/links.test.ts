import { describe, expect, it, vi } from 'vitest';
import { APPROVED_EXTERNAL_HREFS, isExternalHref, openHref } from '../../src/garden/landmarks/links';

const fakeWin = () => ({ open: vi.fn(), location: { assign: vi.fn() } });

describe('isExternalHref', () => {
  it('is true only for absolute https URLs', () => {
    expect(isExternalHref('https://cal.com/x')).toBe(true);
    for (const href of ['/writing/', '//cal.com/x', 'http://cal.com/x', 'writing/']) {
      expect(isExternalHref(href)).toBe(false);
    }
  });
});

describe('APPROVED_EXTERNAL_HREFS', () => {
  it('lists only https URLs', () => {
    for (const href of APPROVED_EXTERNAL_HREFS) expect(isExternalHref(href)).toBe(true);
  });
});

describe('openHref', () => {
  it('opens external links in a new tab without an opener', () => {
    const win = fakeWin();
    openHref(win, 'https://cal.com/x');
    expect(win.open).toHaveBeenCalledWith('https://cal.com/x', '_blank', 'noopener,noreferrer');
    expect(win.location.assign).not.toHaveBeenCalled();
  });
  it('navigates the current tab for internal links', () => {
    const win = fakeWin();
    openHref(win, '/writing/');
    expect(win.location.assign).toHaveBeenCalledWith('/writing/');
    expect(win.open).not.toHaveBeenCalled();
  });
});
