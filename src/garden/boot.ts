export type Mode = 'live' | 'reduced' | 'fallback';

export interface Env {
  readonly webgl: boolean;
  readonly reducedMotion: boolean;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function hasWebGL(win: Window): boolean {
  try {
    const canvas = win.document.createElement('canvas');
    return (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) !== null;
  } catch {
    return false;
  }
}

function prefersReducedMotion(win: Window): boolean {
  try {
    return win.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

export function detectEnv(win: Window): Env {
  return { webgl: hasWebGL(win), reducedMotion: prefersReducedMotion(win) };
}

export function selectMode(env: Env): Mode {
  if (!env.webgl) return 'fallback';
  return env.reducedMotion ? 'reduced' : 'live';
}

export function showFallback(doc: Document): void {
  const fallback = doc.getElementById('fallback');
  if (fallback) fallback.hidden = false;
  for (const id of ['garden', 'reset-view']) {
    const el = doc.getElementById(id);
    if (el) el.hidden = true;
  }
  doc.body.classList.add('is-fallback');
}
