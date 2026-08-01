// src/lib/telephonyBadge.ts
// Single source of truth for the Answered/Missed/Active/Paused/Sent/Failed
// status-badge colors scattered as inline Tailwind ternaries across the
// telephony pages (Call Logs, Campaigns, SMS Logs). Re-theming later is a
// one-file change instead of hunting through each page.

export type TelephonyBadgeTone = 'success' | 'danger' | 'muted';

const TONE_BADGE_CLASS: Record<TelephonyBadgeTone, string> = {
  success: 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-500/15 dark:text-green-400',
  danger: 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-400',
  muted: 'bg-muted text-muted-foreground border',
};

const TONE_DOT_CLASS: Record<TelephonyBadgeTone, string> = {
  success: 'bg-green-500',
  danger: 'bg-red-500',
  muted: 'bg-muted-foreground',
};

/** Tailwind classes for a `<Badge>` in the given semantic tone. */
export function telephonyBadgeClass(tone: TelephonyBadgeTone): string {
  return TONE_BADGE_CLASS[tone];
}

/** Tailwind classes for the small status dot some badges render inline. */
export function telephonyDotClass(tone: TelephonyBadgeTone): string {
  return TONE_DOT_CLASS[tone];
}

export function callOutcomeTone(missed: boolean): TelephonyBadgeTone {
  return missed ? 'danger' : 'success';
}

export function callOutcomeLabel(missed: boolean): string {
  return missed ? 'Missed' : 'Answered';
}

export function campaignActiveTone(isActive: boolean): TelephonyBadgeTone {
  return isActive ? 'success' : 'muted';
}

export function campaignActiveLabel(isActive: boolean): string {
  return isActive ? 'Active' : 'Paused';
}

export function smsStatusTone(failed: boolean): TelephonyBadgeTone {
  return failed ? 'danger' : 'success';
}
