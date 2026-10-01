import { describe, expect, it } from 'vitest';
import { CLICK_THRESHOLD_PX, isClick, reduceTap } from '../../src/garden/pointer-intent';

describe('isClick', () => {
  it('treats small movement as a click', () => {
    expect(isClick({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(true);
  });
  it('rejects movement of exactly the threshold', () => {
    expect(isClick({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(false);
  });
  it('accepts no movement', () => {
    expect(isClick({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(true);
  });
  it('honours a custom threshold', () => {
    expect(isClick({ x: 0, y: 0 }, { x: 5, y: 0 }, 6)).toBe(true);
    expect(CLICK_THRESHOLD_PX).toBe(5);
  });
});

describe('reduceTap', () => {
  it('shows a landmark on first tap', () => {
    expect(reduceTap({ shownId: null }, 'shed')).toEqual({
      state: { shownId: 'shed' },
      action: { kind: 'show', id: 'shed' },
    });
  });
  it('navigates on second tap of the same landmark', () => {
    expect(reduceTap({ shownId: 'shed' }, 'shed')).toEqual({
      state: { shownId: 'shed' },
      action: { kind: 'navigate', id: 'shed' },
    });
  });
  it('dismisses when tapping empty space', () => {
    expect(reduceTap({ shownId: 'shed' }, null)).toEqual({
      state: { shownId: null },
      action: { kind: 'dismiss' },
    });
  });
  it('does nothing when nothing is shown or hit', () => {
    expect(reduceTap({ shownId: null }, null)).toEqual({
      state: { shownId: null },
      action: { kind: 'none' },
    });
  });
  it('switches to a different landmark', () => {
    expect(reduceTap({ shownId: 'a' }, 'b')).toEqual({
      state: { shownId: 'b' },
      action: { kind: 'show', id: 'b' },
    });
  });
  it('never mutates the input state', () => {
    const state = Object.freeze({ shownId: 'a' as string | null });
    expect(() => reduceTap(state, 'b')).not.toThrow();
    expect(state.shownId).toBe('a');
  });
});
