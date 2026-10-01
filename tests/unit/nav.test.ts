import { describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { buildNav } from '../../src/garden/nav';
import { injectNavLinks } from '../../src/garden/nav-markup';
import { placements } from '../../src/garden/landmarks/registry';

const makeList = () => document.createElement('ul');

/** The nav list as the built index.html ships it, with the links already in the markup. */
function prerenderedList(): HTMLUListElement {
  const doc = new DOMParser().parseFromString(injectNavLinks(indexHtml, placements), 'text/html');
  const list = document.importNode(doc.getElementById('site-nav-list')!, true) as HTMLUListElement;
  expect(list.querySelectorAll('a')).toHaveLength(placements.length);
  return list;
}

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
  it('does not duplicate links when called twice', () => {
    const list = makeList();
    const hooks = { onFocus: vi.fn(), onBlur() {} };
    buildNav(list, placements, hooks);
    const [a] = buildNav(list, placements, hooks);
    expect(list.querySelectorAll('li')).toHaveLength(placements.length);
    a.dispatchEvent(new FocusEvent('focus'));
    expect(hooks.onFocus).toHaveBeenCalledTimes(1);
  });
  it('hydrates links already in the HTML instead of recreating them', () => {
    const list = prerenderedList();
    const existing = list.querySelector('a')!;
    const hooks = { onFocus: vi.fn(), onBlur: vi.fn() };
    const links = buildNav(list, placements, hooks);
    expect(links[0]).toBe(existing);
    expect(list.querySelectorAll('a')).toHaveLength(placements.length);
    existing.dispatchEvent(new FocusEvent('focus'));
    expect(hooks.onFocus).toHaveBeenCalledWith('library-shed');
  });
  it('creates only the links missing from the HTML', () => {
    const list = prerenderedList();
    const extra = { ...placements[0], landmark: { ...placements[0].landmark, id: 'extra', href: '/extra/', label: 'Extra' } };
    const links = buildNav(list, [...placements, extra], { onFocus() {}, onBlur() {} });
    expect(list.querySelectorAll('li')).toHaveLength(placements.length + 1);
    expect(links.at(-1)?.getAttribute('href')).toBe('/extra/');
    expect(links.at(-1)?.textContent).toBe('Extra');
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
