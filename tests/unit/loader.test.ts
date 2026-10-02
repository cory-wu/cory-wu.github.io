import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';

function page(): Document {
  return new DOMParser().parseFromString(indexHtml, 'text/html');
}

describe('loading state markup', () => {
  it('is a status region announcing the garden is loading', () => {
    const loader = page().getElementById('loader');
    expect(loader).not.toBeNull();
    expect(loader!.getAttribute('role')).toBe('status');
    expect(loader!.textContent?.trim()).toBe('Planting the garden…');
  });

  it('draws a decorative low-poly tile hidden from assistive tech', () => {
    const svg = page().querySelector('#loader svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelectorAll('polygon')).toHaveLength(3);
  });

  it('follows #garden so CSS can hide it once the garden is ready', () => {
    const doc = page();
    const garden = doc.getElementById('garden')!;
    const loader = doc.getElementById('loader')!;
    expect(garden.compareDocumentPosition(loader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(loader.parentElement).toBe(garden.parentElement);
  });

  it('marks the page as JS-enabled from the head, so no-JS visitors never see a stuck loader', () => {
    const script = page().head.querySelector('script:not([src])');
    expect(script?.textContent).toContain("classList.add('js')");
  });
});
