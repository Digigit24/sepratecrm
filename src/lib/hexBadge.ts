// src/lib/hexBadge.ts
// Shared helper for hex-driven dynamic badges (lead status, priority, groups
// — anywhere a CRM-configured color_hex needs to become a tinted badge).
// Replaces the ad hoc `${hex}18` / `${hex}30` alpha-suffix string concat
// that was duplicated inline wherever these badges were rendered.

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface HexBadgeStyle {
  backgroundColor: string;
  color: string;
  border: string;
}

/** Background/text/border style for a pill badge tinted from a CRM color_hex. */
export function hexBadgeStyle(hex?: string | null, fallback = '#6b7280'): HexBadgeStyle {
  const c = hex || fallback;
  return {
    backgroundColor: hexToRgba(c, 0.1),
    color: c,
    border: `1px solid ${hexToRgba(c, 0.2)}`,
  };
}
