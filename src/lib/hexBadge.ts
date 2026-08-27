// src/lib/hexBadge.ts
// Shared helper for hex-driven dynamic badges (lead status, priority, groups
// — anywhere a CRM-configured color_hex needs to become a tinted badge).
// Replaces the ad hoc `${hex}18` / `${hex}30` alpha-suffix string concat
// that was duplicated inline wherever these badges were rendered.
//
// CONTRAST FIX — the original formula used the tenant's `color_hex` as BOTH
// a ~10% fill and the label colour on top of it. A colour cannot be legible
// against a faint wash of itself: there is only ~10% of a difference, so
// every badge failed WCAG AA (measured as low as ~2:1 against the 4.5:1
// requirement). The identical bug was found and fixed first on the mobile
// app's `hexBadgeStyle` (celiyocrmmobileapp `src/features/leads/utils/
// hexBadge.ts`) — this ports that same fix here.
//
// The fix keeps the hue the tenant chose and walks its lightness — darker in
// light mode, lighter in dark — until the label clears AA against the
// composited fill. A tenant who picks pale yellow still gets pale yellow as
// the pill, with a dark amber label on it, rather than invisible text.

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface HexBadgeStyle {
  backgroundColor: string;
  color: string;
  border: string;
}

/** The `--card` colour each scheme composites the fill over — mirrors `globals.css`. */
const CARD_RGB: Record<'light' | 'dark', RGB> = {
  light: { r: 255, g: 255, b: 255 },
  dark: { r: 17, g: 19, b: 23 },
};

const AA_CONTRAST = 4.5;
const FILL_ALPHA = 0.1;
const BORDER_ALPHA = 0.2;

/**
 * Background/text/border style for a pill badge tinted from a CRM color_hex.
 *
 * `scheme` is optional so existing call sites keep working unchanged; it
 * defaults to light. Pass it (e.g. from `useTheme()`) wherever the badge can
 * render in dark mode — the label needs to walk the other direction there.
 */
export function hexBadgeStyle(
  hex?: string | null,
  fallback = '#6b7280',
  scheme: 'light' | 'dark' = 'light'
): HexBadgeStyle {
  const c = hex || fallback;
  const tint = parseHex(c);
  const filled = composite(tint, FILL_ALPHA, CARD_RGB[scheme]);

  return {
    backgroundColor: hexToRgba(c, FILL_ALPHA),
    color: toHex(readableOn(tint, filled, scheme)),
    border: `1px solid ${hexToRgba(c, BORDER_ALPHA)}`,
  };
}

// ---------------------------------------------------------------------------
// Colour maths. Small and self-contained on purpose — pulling in a colour
// library for one contrast walk would be the larger cost.
// ---------------------------------------------------------------------------

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseHex(hex: string): RGB {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

function toHex({ r, g, b }: RGB): string {
  const part = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** `fg` at `alpha` over `bg` — what the eye actually sees through a wash. */
function composite(fg: RGB, alpha: number, bg: RGB): RGB {
  return {
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  };
}

function relativeLuminance({ r, g, b }: RGB): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Scale every channel toward black (`t < 1`) or toward white (`t > 1`). */
function shift(c: RGB, toWhite: boolean, amount: number): RGB {
  return toWhite
    ? { r: c.r + (255 - c.r) * amount, g: c.g + (255 - c.g) * amount, b: c.b + (255 - c.b) * amount }
    : { r: c.r * (1 - amount), g: c.g * (1 - amount), b: c.b * (1 - amount) };
}

/**
 * The tenant's hue, moved just far enough to be readable on `background`.
 *
 * Walks in 5% steps rather than solving directly: the relationship between a
 * channel shift and the resulting contrast ratio is not linear, and twenty
 * iterations of arithmetic is cheaper than being clever about it. Returns the
 * first step that clears AA, so the hue moves as little as possible; if even
 * full black/white would not clear it (impossible for a ~10% wash, but the
 * loop should not depend on that), the last step is returned rather than
 * looping.
 */
function readableOn(color: RGB, background: RGB, scheme: 'light' | 'dark'): RGB {
  if (contrast(color, background) >= AA_CONTRAST) return color;

  const toWhite = scheme === 'dark';
  let candidate = color;
  for (let step = 1; step <= 20; step += 1) {
    candidate = shift(color, toWhite, step * 0.05);
    if (contrast(candidate, background) >= AA_CONTRAST) return candidate;
  }
  return candidate;
}
