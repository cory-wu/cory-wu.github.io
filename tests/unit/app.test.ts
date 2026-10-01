import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { startGarden } from '../../src/garden/app';

function mountIndexBody(): void {
  const parsed = new DOMParser().parseFromString(indexHtml, 'text/html');
  document.body.className = '';
  document.body.replaceChildren(...Array.from(parsed.body.children).filter((el) => el.tagName !== 'SCRIPT'));
}

const navLinks = () => Array.from(document.querySelectorAll<HTMLAnchorElement>('#site-nav a'));
const byId = (id: string) => document.getElementById(id) as HTMLElement;

beforeEach(() => {
  mountIndexBody();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('startGarden without WebGL', () => {
  it('resolves to fallback mode with the nav built and the image shown', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const createRenderer = vi.fn();

    const result = await startGarden(window, { createRenderer });

    expect(result).toEqual({ mode: 'fallback' });
    expect(createRenderer).not.toHaveBeenCalled();
    expect(navLinks()).toHaveLength(1);
    expect(navLinks()[0].getAttribute('href')).toBe('/writing/');
    expect(navLinks()[0].textContent).toBe('Writing');
    expect(byId('fallback').hidden).toBe(false);
    expect(byId('garden').hidden).toBe(true);
    expect(document.body.classList.contains('is-fallback')).toBe(true);
  });
});

describe('startGarden when scene setup throws', () => {
  it('falls back, logs the error and keeps the nav', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = new Error('no renderer');

    const result = await startGarden(window, {
      createRenderer: () => {
        throw boom;
      },
    });

    expect(result).toEqual({ mode: 'fallback' });
    expect(error).toHaveBeenCalledWith(expect.any(String), boom);
    expect(navLinks()).toHaveLength(1);
    expect(navLinks()[0].getAttribute('href')).toBe('/writing/');
    expect(byId('fallback').hidden).toBe(false);
    expect(byId('reset-view').hidden).toBe(true);
    expect(byId('garden').querySelector('canvas')).toBeNull();
  });
});

describe('index markup', () => {
  it('wraps the page content in a main landmark', () => {
    const main = document.querySelector('main');
    expect(main).not.toBeNull();
    for (const id of ['garden', 'fallback', 'reset-view']) expect(main?.contains(byId(id))).toBe(true);
    expect(main?.querySelector('h1')?.textContent).toBe('Cory Wu');
    expect(main?.querySelector('.garden-description')).not.toBeNull();
    expect(document.getElementById('site-nav')).not.toBeNull();
  });
});
