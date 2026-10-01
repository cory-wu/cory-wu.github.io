import type { Placement } from './landmarks/types';

export interface NavHooks {
  onFocus(id: string): void;
  onBlur(id: string): void;
}

export function buildNav(list: HTMLUListElement, ps: Placement[], hooks: NavHooks): HTMLAnchorElement[] {
  const links = ps.map(({ landmark }) => {
    const a = document.createElement('a');
    a.href = landmark.href;
    a.textContent = landmark.label;
    a.dataset.landmarkId = landmark.id;
    a.addEventListener('focus', () => hooks.onFocus(landmark.id));
    a.addEventListener('blur', () => hooks.onBlur(landmark.id));
    return a;
  });
  list.replaceChildren(
    ...links.map((a) => {
      const li = document.createElement('li');
      li.append(a);
      return li;
    }),
  );
  return links;
}
