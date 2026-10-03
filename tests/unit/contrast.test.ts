import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA, relativeLuminance } from '../../src/site/contrast';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 2);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('does not depend on argument order', () => {
    expect(contrastRatio('#1f2a1f', '#f4f1e8')).toBeCloseTo(contrastRatio('#f4f1e8', '#1f2a1f'), 10);
  });

  it('rates the site ink on paper well above AA', () => {
    expect(contrastRatio('#1f2a1f', '#f4f1e8')).toBeGreaterThan(12);
  });

  it('accepts uppercase and short hex', () => {
    expect(contrastRatio('#FFF', '#000000')).toBeCloseTo(21, 2);
  });

  it('throws on anything that is not #rgb or #rrggbb', () => {
    for (const bad of ['red', '#12345', '', '#ggg', 'ffffff']) {
      expect(() => contrastRatio(bad, '#fff'), bad).toThrow(/colour|color/i);
    }
  });
});

describe('meetsAA', () => {
  it('passes at 4.5:1 and fails just below', () => {
    expect(meetsAA('#767676', '#ffffff')).toBe(true);
    expect(meetsAA('#777777', '#ffffff')).toBe(false);
  });
});
