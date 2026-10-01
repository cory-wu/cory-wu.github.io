import type { Placement } from './landmarks/types';

export interface NavHooks {
  onFocus(id: string): void;
  onBlur(id: string): void;
}

/** Anchors that already carry focus/blur hooks, so a second hydration never doubles them. */
const hooked = new WeakSet<HTMLAnchorElement>();

function findLink(list: HTMLUListElement, id: string): HTMLAnchorElement | undefined {
  return Array.from(list.querySelectorAll<HTMLAnchorElement>('a[data-landmark-id]')).find(
    (a) => a.dataset.landmarkId === id,
  );
}

function createLink(list: HTMLUListElement, { id, href, label }: Placement['landmark']): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = label;
  a.dataset.landmarkId = id;
  const li = document.createElement('li');
  li.append(a);
  list.append(li);
  return a;
}

/**
 * Hydrates the landmark links that index.html ships (see nav-markup.ts):
 * attaches focus/blur hooks, and creates only links missing from the markup.
 */
export function buildNav(list: HTMLUListElement, ps: Placement[], hooks: NavHooks): HTMLAnchorElement[] {
  return ps.map(({ landmark }) => {
    const a = findLink(list, landmark.id) ?? createLink(list, landmark);
    if (!hooked.has(a)) {
      hooked.add(a);
      a.addEventListener('focus', () => hooks.onFocus(landmark.id));
      a.addEventListener('blur', () => hooks.onBlur(landmark.id));
    }
    return a;
  });
}
