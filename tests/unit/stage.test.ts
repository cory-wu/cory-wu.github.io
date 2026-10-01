import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PCFShadowMap } from 'three';
import type { WebGLRenderer } from 'three';
import { createStage } from '../../src/garden/stage';

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
    shadowMap: {} as { enabled?: boolean; type?: number },
    domElement: document.createElement('canvas'),
    dispose: vi.fn(),
  };
}

let frames: Map<number, Frame>;
let nextId: number;
let clock: number;

function flushFrame(advance = 16): void {
  clock += advance;
  const pending = [...frames.values()];
  frames.clear();
  for (const f of pending) f(clock);
}

function setup(onDemand: boolean, onError?: (err: unknown) => void) {
  const host = document.createElement('div');
  const renderer = stubRenderer();
  const stage = createStage(host, {
    renderer: renderer as unknown as WebGLRenderer,
    onDemand,
    now: () => clock,
    onError,
  });
  return { host, renderer, stage };
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  frames = new Map();
  nextId = 1;
  clock = 1000;
  StubResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  vi.stubGlobal('requestAnimationFrame', (cb: Frame) => {
    const id = nextId++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id);
  });
});

afterEach(() => {
  setHidden(false);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('stage setup', () => {
  it('configures the renderer and mounts the canvas', () => {
    const { host, renderer, stage } = setup(true);
    expect(host.contains(renderer.domElement)).toBe(true);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.shadowMap.type).toBe(PCFShadowMap);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(Math.min(window.devicePixelRatio, 2));
    stage.dispose();
  });
});

describe('resize', () => {
  it('updates camera aspect and renderer size', () => {
    const { renderer, stage } = setup(true);
    stage.resize(400, 800);
    expect(stage.camera.aspect).toBe(0.5);
    expect(renderer.setSize).toHaveBeenCalledWith(400, 800);
    stage.dispose();
  });
  it('is a no-op for zero or negative sizes', () => {
    const { renderer, stage } = setup(true);
    stage.resize(400, 800);
    renderer.setSize.mockClear();
    stage.resize(400, 0);
    stage.resize(0, 800);
    stage.resize(-1, -1);
    expect(renderer.setSize).not.toHaveBeenCalled();
    expect(stage.camera.aspect).toBe(0.5);
    stage.dispose();
  });
  it('reports each valid new aspect through onResize', () => {
    const host = document.createElement('div');
    const onResize = vi.fn();
    const stage = createStage(host, {
      renderer: stubRenderer() as unknown as WebGLRenderer,
      onDemand: true,
      onResize,
    });
    onResize.mockClear();
    stage.resize(400, 800);
    stage.resize(0, 800);
    const ro = StubResizeObserver.instances[0]!;
    ro.cb([{ contentRect: { width: 900, height: 300 } } as ResizeObserverEntry], ro as unknown as ResizeObserver);
    expect(onResize.mock.calls).toEqual([[0.5], [3]]);
    stage.dispose();
  });
  it('follows the ResizeObserver on the host', () => {
    const { host, renderer, stage } = setup(true);
    const ro = StubResizeObserver.instances[0]!;
    expect(ro.observe).toHaveBeenCalledWith(host);
    ro.cb([{ contentRect: { width: 300, height: 600 } } as ResizeObserverEntry], ro as unknown as ResizeObserver);
    expect(renderer.setSize).toHaveBeenCalledWith(300, 600);
    stage.dispose();
  });
});

describe('on-demand rendering', () => {
  it('coalesces requestRender calls into one render per frame', () => {
    const { renderer, stage } = setup(true);
    stage.requestRender();
    stage.requestRender();
    expect(renderer.render).not.toHaveBeenCalled();
    flushFrame();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    flushFrame();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    stage.dispose();
  });
  it('start renders one frame and does not loop', () => {
    const { renderer, stage } = setup(true);
    stage.start();
    flushFrame();
    flushFrame();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    stage.dispose();
  });
  it('runs onFrame callbacks for each rendered frame', () => {
    const { stage } = setup(true);
    const cb = vi.fn();
    stage.onFrame(cb);
    stage.requestRender();
    flushFrame();
    expect(cb).toHaveBeenCalledTimes(1);
    stage.dispose();
  });
});

describe('continuous rendering', () => {
  it('loops and passes dt and elapsed in seconds', () => {
    const { renderer, stage } = setup(false);
    const cb = vi.fn();
    stage.onFrame(cb);
    stage.start();
    flushFrame(16);
    flushFrame(32);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, expect.closeTo(0.016, 6), expect.closeTo(0.016, 6));
    expect(cb).toHaveBeenNthCalledWith(2, expect.closeTo(0.032, 6), expect.closeTo(0.048, 6));
    stage.dispose();
  });
  it('start and stop are idempotent', () => {
    const { renderer, stage } = setup(false);
    stage.start();
    stage.start();
    flushFrame();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    stage.stop();
    stage.stop();
    flushFrame();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    stage.dispose();
  });
  it('pauses while the document is hidden and resumes when visible', () => {
    const { renderer, stage } = setup(false);
    stage.start();
    flushFrame();
    setHidden(true);
    flushFrame();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    setHidden(false);
    flushFrame();
    expect(renderer.render).toHaveBeenCalledTimes(2);
    stage.dispose();
  });
  it('does not count hidden time in the next dt', () => {
    const { stage } = setup(false);
    const cb = vi.fn();
    stage.onFrame(cb);
    stage.start();
    flushFrame(16);
    setHidden(true);
    clock += 60_000;
    setHidden(false);
    flushFrame(16);
    expect(cb.mock.calls[1]![0]).toBeCloseTo(0.016, 6);
    stage.dispose();
  });
});

describe('dispose', () => {
  it('cancels frames, disconnects observers and listeners, and releases the renderer', () => {
    const { host, renderer, stage } = setup(false);
    stage.start();
    stage.dispose();
    expect(StubResizeObserver.instances[0]!.disconnect).toHaveBeenCalled();
    expect(renderer.dispose).toHaveBeenCalled();
    expect(host.contains(renderer.domElement)).toBe(false);
    flushFrame();
    expect(renderer.render).not.toHaveBeenCalled();
    setHidden(true);
    setHidden(false);
    flushFrame();
    expect(renderer.render).not.toHaveBeenCalled();
  });
});

describe('frame errors', () => {
  it('stops the loop and reports when render throws', () => {
    const onError = vi.fn();
    const { renderer, stage } = setup(false, onError);
    const boom = new Error('render failed');
    renderer.render.mockImplementation(() => {
      throw boom;
    });
    stage.start();
    expect(() => flushFrame()).not.toThrow();
    expect(onError).toHaveBeenCalledExactlyOnceWith(boom);
    expect(frames.size).toBe(0);
    stage.requestRender();
    stage.start();
    flushFrame();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    stage.dispose();
  });
  it('reports a throwing frame callback on the first frame without rendering', () => {
    const onError = vi.fn();
    const { renderer, stage } = setup(true, onError);
    const boom = new Error('callback failed');
    stage.onFrame(() => {
      throw boom;
    });
    stage.start();
    flushFrame();
    expect(onError).toHaveBeenCalledExactlyOnceWith(boom);
    expect(renderer.render).not.toHaveBeenCalled();
    stage.requestRender();
    flushFrame();
    expect(onError).toHaveBeenCalledTimes(1);
    stage.dispose();
  });
});
