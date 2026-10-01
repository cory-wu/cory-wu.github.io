import { afterEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../index.html?raw';
import { detectEnv, selectMode, showFallback } from '../../src/garden/boot';

afterEach(() => {
  vi.restoreAllMocks();
});

const loadIndexDoc = (): Document => new DOMParser().parseFromString(indexHtml, 'text/html');

describe('selectMode', () => {
  it('falls back without WebGL', () => {
    expect(selectMode({ webgl: false, reducedMotion: false })).toBe('fallback');
    expect(selectMode({ webgl: false, reducedMotion: true })).toBe('fallback');
  });
  it('uses reduced mode with WebGL and reduced motion', () => {
    expect(selectMode({ webgl: true, reducedMotion: true })).toBe('reduced');
  });
  it('uses live mode with WebGL and no reduced motion', () => {
    expect(selectMode({ webgl: true, reducedMotion: false })).toBe('live');
  });
});

describe('detectEnv', () => {
  const stubMatchMedia = (matches: boolean) =>
    vi.fn((query: string) => ({ matches, media: query }) as MediaQueryList);

  it('reports no WebGL in jsdom', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const matchMedia = stubMatchMedia(false);
    const env = detectEnv({ document, matchMedia } as unknown as Window);
    expect(env).toEqual({ webgl: false, reducedMotion: false });
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
  it('reports WebGL when a context is available and reads reduced motion', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
    const env = detectEnv({ document, matchMedia: stubMatchMedia(true) } as unknown as Window);
    expect(env).toEqual({ webgl: true, reducedMotion: true });
  });
  it('falls back to webgl1 when webgl2 is unavailable', () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(((type: string) => (type === 'webgl' ? {} : null)) as never);
    const env = detectEnv({ document, matchMedia: stubMatchMedia(false) } as unknown as Window);
    expect(env.webgl).toBe(true);
    expect(getContext).toHaveBeenCalledWith('webgl2');
    expect(getContext).toHaveBeenCalledWith('webgl');
  });
  it('does not throw when getContext throws or matchMedia is missing', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('no gl');
    });
    expect(detectEnv({ document } as unknown as Window)).toEqual({
      webgl: false,
      reducedMotion: false,
    });
  });
});

describe('showFallback', () => {
  it('shows the image, hides the scene and reset button, keeps the nav', () => {
    const doc = loadIndexDoc();
    showFallback(doc);
    expect(doc.getElementById('fallback')!.hidden).toBe(false);
    expect(doc.getElementById('garden')!.hidden).toBe(true);
    expect(doc.getElementById('reset-view')!.hidden).toBe(true);
    expect(doc.getElementById('site-nav')!.hidden).toBe(false);
    expect(doc.body.classList.contains('is-fallback')).toBe(true);
  });
  it('is idempotent', () => {
    const doc = loadIndexDoc();
    showFallback(doc);
    showFallback(doc);
    expect(doc.getElementById('fallback')!.hidden).toBe(false);
    expect(doc.getElementById('garden')!.hidden).toBe(true);
    expect(doc.body.classList.length).toBe(1);
  });
  it('tolerates missing elements', () => {
    const doc = document.implementation.createHTMLDocument('x');
    expect(() => showFallback(doc)).not.toThrow();
    expect(doc.body.classList.contains('is-fallback')).toBe(true);
  });
});
