import { describe, expect, it, vi } from 'vitest';
import { buildNav } from '../../src/garden/nav';
import { placements } from '../../src/garden/landmarks/registry';

const makeList = () => document.createElement('ul');

describe('buildNav', () => {
  it('renders one link per placement', () => {
    const list = makeList();
    const links = buildNav(list, placements, { onFocus() {}, onBlur() {} });
    expect(links).toHaveLength(placements.length);
    const a = list.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/writing/');
    expect(a.textContent).toBe('Writing');
    expect(a.dataset.landmarkId).toBe('library-shed');
    expect(a.parentElement?.tagName).toBe('LI');
  });
  it('replaces previous children instead of duplicating', () => {
    const list = makeList();
    const hooks = { onFocus() {}, onBlur() {} };
    buildNav(list, placements, hooks);
    buildNav(list, placements, hooks);
    expect(list.querySelectorAll('li')).toHaveLength(placements.length);
  });
  it('calls focus/blur hooks with the landmark id', () => {
    const list = makeList();
    const hooks = { onFocus: vi.fn(), onBlur: vi.fn() };
    const [a] = buildNav(list, placements, hooks);
    a.dispatchEvent(new FocusEvent('focus'));
    a.dispatchEvent(new FocusEvent('blur'));
    expect(hooks.onFocus).toHaveBeenCalledWith('library-shed');
    expect(hooks.onBlur).toHaveBeenCalledWith('library-shed');
  });
  it('does not throw with no-op hooks (fallback mode)', () => {
    const [a] = buildNav(makeList(), placements, { onFocus() {}, onBlur() {} });
    expect(() => a.dispatchEvent(new FocusEvent('focus'))).not.toThrow();
  });
});
