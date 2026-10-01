import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import indexHtml from '../../index.html?raw';
import writingHtml from '../../writing/index.html?raw';
import { injectNavLinks } from '../../src/garden/nav-markup';
import { placements } from '../../src/garden/landmarks/registry';
import type { Placement } from '../../src/garden/landmarks/types';

const links = (html: string) =>
  Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll<HTMLAnchorElement>('#site-nav-list > li > a'));

describe('injectNavLinks', () => {
  it('emits one link per registry placement into the index nav list', () => {
    const out = links(injectNavLinks(indexHtml, placements));
    expect(out.map((a) => [a.getAttribute('href'), a.textContent, a.dataset.landmarkId])).toEqual(
      placements.map(({ landmark }) => [landmark.href, landmark.label, landmark.id]),
    );
  });

  it('leaves pages without the empty nav list unchanged', () => {
    expect(injectNavLinks(writingHtml, placements)).toBe(writingHtml);
  });

  it('does not inject twice', () => {
    const once = injectNavLinks(indexHtml, placements);
    expect(injectNavLinks(once, placements)).toBe(once);
  });

  it('escapes registry text and attributes', () => {
    const tricky: Placement = {
      landmark: { id: 'a"b', label: '<b>&</b>', href: '/x/?a=1&b="2"', build: async () => ({ object: new Group() }) },
      position: [0, 0],
      rotationY: 0,
    };
    const [a] = links(injectNavLinks(indexHtml, [tricky]));
    expect(a.textContent).toBe('<b>&</b>');
    expect(a.querySelector('b')).toBeNull();
    expect(a.getAttribute('href')).toBe('/x/?a=1&b="2"');
    expect(a.dataset.landmarkId).toBe('a"b');
  });
});
