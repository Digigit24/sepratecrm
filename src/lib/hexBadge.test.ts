import { describe, expect, it } from 'vitest';
import { hexBadgeStyle } from './hexBadge';

// WCAG AA contrast check for hex-on-rgba(hex,alpha)-over-card, mirroring the
// math in hexBadge.ts itself (kept independent here rather than imported, so
// a bug in the shared math can't hide from its own test).
function parseHex(hex: string) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function parseRgba(rgba: string) {
  const m = rgba.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (!m) throw new Error(`Unparseable rgba(): ${rgba}`);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] !== undefined ? Number(m[4]) : 1 };
}

const CARD_RGB = {
  light: { r: 255, g: 255, b: 255 },
  dark: { r: 17, g: 19, b: 23 },
};

function composite(fg: { r: number; g: number; b: number }, alpha: number, bg: { r: number; g: number; b: number }) {
  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function contrastOfBadge(hex: string, scheme: 'light' | 'dark') {
  const style = hexBadgeStyle(hex, undefined, scheme);
  const fill = parseRgba(style.backgroundColor);
  const filled = composite(parseHex(hex), fill.a, CARD_RGB[scheme]);
  const label = parseHex(style.color);
  return contrastRatio(label, filled);
}

// A spread of hues, lightnesses and saturations, including the edge cases
// most likely to break a naive contrast walk: pure white, pure black, a
// mid-lightness saturated hue on each side of the wheel, and a pale, almost-
// white tenant colour (the case that most needs the fix to still "look like"
// what the tenant picked instead of being replaced outright).
const SAMPLE_HEXES = [
  '#ffffff', // pure white
  '#000000', // pure black
  '#ff0000', // red
  '#00ff00', // green
  '#0000ff', // blue
  '#ffff00', // yellow
  '#00ffff', // cyan
  '#ff00ff', // magenta
  '#f59e0b', // amber (a real tenant status colour)
  '#7c3aed', // violet
  '#fef9c3', // pale yellow — the "barely a colour" edge case
  '#111317', // near the dark-mode card colour itself
];

describe('hexBadgeStyle contrast', () => {
  for (const scheme of ['light', 'dark'] as const) {
    describe(`${scheme} scheme`, () => {
      for (const hex of SAMPLE_HEXES) {
        it(`clears WCAG AA (4.5:1) for ${hex}`, () => {
          expect(contrastOfBadge(hex, scheme)).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }

  it('falls back to the default grey when no hex is supplied', () => {
    const style = hexBadgeStyle(null, '#6b7280', 'light');
    expect(style.color).toBeTruthy();
    expect(contrastOfBadge('#6b7280', 'light')).toBeGreaterThanOrEqual(4.5);
  });

  it('defaults to the light scheme when none is passed', () => {
    const withScheme = hexBadgeStyle('#f59e0b', undefined, 'light');
    const withoutScheme = hexBadgeStyle('#f59e0b');
    expect(withoutScheme).toEqual(withScheme);
  });

  it('keeps the background/border tinted with the tenant hue, not the walked label colour', () => {
    const style = hexBadgeStyle('#f59e0b', undefined, 'light');
    expect(style.backgroundColor).toBe('rgba(245, 158, 11, 0.1)');
    expect(style.border).toBe('1px solid rgba(245, 158, 11, 0.2)');
  });
});
