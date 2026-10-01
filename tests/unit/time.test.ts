import { describe, expect, it } from 'vitest';
import { currentMinutes, parseTimeParam } from '../../src/garden/time';

describe('parseTimeParam', () => {
  it('parses valid HH:MM values to minutes since midnight', () => {
    expect(parseTimeParam('?time=21:30')).toBe(1290);
    expect(parseTimeParam('?time=00:00')).toBe(0);
    expect(parseTimeParam('?time=23:59')).toBe(1439);
    expect(parseTimeParam('?foo=1&time=06:15')).toBe(375);
  });

  it('returns null for absent or invalid values', () => {
    for (const s of ['?time=24:00', '?time=7:5', '?time=ab:cd', '?time=', '', '?foo=1']) {
      expect(parseTimeParam(s)).toBeNull();
    }
  });
});

describe('currentMinutes', () => {
  it('uses local hours and minutes', () => {
    expect(currentMinutes(new Date(2026, 0, 1, 13, 7))).toBe(787);
  });
});
