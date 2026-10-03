/** WCAG 2.x contrast helpers for the site's colour tokens and per-page themes. */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const AA_RATIO = 4.5;

function channels(hex: string): [number, number, number] {
  if (!HEX.test(hex)) throw new Error(`Not a #rgb or #rrggbb colour: "${hex}"`);
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const linear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function meetsAA(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= AA_RATIO;
}
