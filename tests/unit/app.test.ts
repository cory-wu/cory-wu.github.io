import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import type { WebGLRenderer } from 'three';
import { hasE2eFlag, startGarden } from '../../src/garden/app';

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

type Frame = (t: number) => void;

class StubResizeObserver {
  static instances: StubResizeObserver[] = [];
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    StubResizeObserver.instances.push(this);
  }
}

function stubRenderer() {
  return {
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    shadowMap: {},
    domElement: document.createElement('canvas'),
    dispose: vi.fn(),
  };
}

describe('startGarden with a (stub) WebGL renderer', () => {
  let frames: Map<number, Frame>;

  const flushFrame = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const f of pending) f(performance.now());
  };

  beforeEach(() => {
    frames = new Map();
    let nextId = 1;
    StubResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', StubResizeObserver);
    vi.stubGlobal('requestAnimationFrame', (cb: Frame) => {
      frames.set(nextId, cb);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    // WebGL "exists" for mode detection; no 2D context, as in jsdom (the sky falls back to a flat colour).
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((id: string) =>
      id.startsWith('webgl') ? {} : null) as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function start() {
    const renderer = stubRenderer();
    const result = await startGarden(window, { createRenderer: () => renderer as unknown as WebGLRenderer });
    return { renderer, result };
  }

  it('shows the fallback when the first frame throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { renderer, result } = await start();
    expect(result).toEqual({ mode: 'live' });
    const boom = new Error('render failed');
    renderer.render.mockImplementation(() => {
      throw boom;
    });
    expect(() => flushFrame()).not.toThrow();
    await Promise.resolve();

    expect(error).toHaveBeenCalledWith(expect.any(String), boom);
    expect(byId('fallback').hidden).toBe(false);
    expect(byId('garden').hidden).toBe(true);
    expect(byId('garden').classList.contains('is-ready')).toBe(false);
    expect(renderer.dispose).toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expect(navLinks()).toHaveLength(1);
  });

  it('on context loss hides the label, disposes the stage and shows the fallback', async () => {
    const { renderer } = await start();
    flushFrame();
    byId('landmark-label').hidden = false;
    renderer.domElement.dispatchEvent(new Event('webglcontextlost'));

    expect(byId('landmark-label').hidden).toBe(true);
    expect(byId('fallback').hidden).toBe(false);
    expect(renderer.dispose).toHaveBeenCalled();
    expect(StubResizeObserver.instances[0]!.disconnect).toHaveBeenCalled();
    expect(byId('garden').querySelector('canvas')).toBeNull();
    expect(frames.size).toBe(0);
  });
});

describe('hasE2eFlag', () => {
  it('accepts an e2e query parameter with or without a value', () => {
    expect(hasE2eFlag('?e2e')).toBe(true);
    expect(hasE2eFlag('?time=12:00&e2e')).toBe(true);
    expect(hasE2eFlag('?e2e=1')).toBe(true);
  });
  it('ignores e2e appearing inside other names or values', () => {
    expect(hasE2eFlag('')).toBe(false);
    expect(hasE2eFlag('?note2e')).toBe(false);
    expect(hasE2eFlag('?time=e2e')).toBe(false);
    expect(hasE2eFlag('?e2etest=1')).toBe(false);
  });
});
