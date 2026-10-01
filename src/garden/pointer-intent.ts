export const CLICK_THRESHOLD_PX = 5;

type Point = { x: number; y: number };

/** True when the pointer moved strictly less than `threshold` px between down and up. */
export function isClick(down: Point, up: Point, threshold = CLICK_THRESHOLD_PX): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) < threshold;
}

export type TapState = { shownId: string | null };

export type TapAction =
  | { kind: 'show'; id: string }
  | { kind: 'navigate'; id: string }
  | { kind: 'dismiss' }
  | { kind: 'none' };

/** Touch-style two-step tap: first tap shows a landmark's label, second navigates. */
export function reduceTap(
  state: TapState,
  hitId: string | null,
): { state: TapState; action: TapAction } {
  if (hitId === null) {
    return state.shownId === null
      ? { state: { shownId: null }, action: { kind: 'none' } }
      : { state: { shownId: null }, action: { kind: 'dismiss' } };
  }
  if (state.shownId === hitId) {
    return { state: { shownId: hitId }, action: { kind: 'navigate', id: hitId } };
  }
  return { state: { shownId: hitId }, action: { kind: 'show', id: hitId } };
}
