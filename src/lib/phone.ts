// src/lib/phone.ts
//
// Phone helpers for lead numbers. Canonical stored form is a FULL international
// MSISDN with digits only (e.g. 919423217356) — the same shape the backend's
// normalize_msisdn produces, so FE and BE agree.

export interface Country {
  code: string; // ISO-3166 alpha-2
  name: string;
  dial: string; // dial code, digits only (e.g. '91')
  flag: string; // emoji flag
}

// Common countries, India first (default). Not exhaustive — searchable picker.
export const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', dial: '91', flag: '🇮🇳' },
  { code: 'US', name: 'United States', dial: '1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '44', flag: '🇬🇧' },
  { code: 'AE', name: 'United Arab Emirates', dial: '971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dial: '966', flag: '🇸🇦' },
  { code: 'SG', name: 'Singapore', dial: '65', flag: '🇸🇬' },
  { code: 'AU', name: 'Australia', dial: '61', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', dial: '1', flag: '🇨🇦' },
  { code: 'DE', name: 'Germany', dial: '49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', dial: '39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', dial: '34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', dial: '31', flag: '🇳🇱' },
  { code: 'PK', name: 'Pakistan', dial: '92', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', dial: '880', flag: '🇧🇩' },
  { code: 'LK', name: 'Sri Lanka', dial: '94', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal', dial: '977', flag: '🇳🇵' },
  { code: 'MY', name: 'Malaysia', dial: '60', flag: '🇲🇾' },
  { code: 'ID', name: 'Indonesia', dial: '62', flag: '🇮🇩' },
  { code: 'PH', name: 'Philippines', dial: '63', flag: '🇵🇭' },
  { code: 'TH', name: 'Thailand', dial: '66', flag: '🇹🇭' },
  { code: 'CN', name: 'China', dial: '86', flag: '🇨🇳' },
  { code: 'JP', name: 'Japan', dial: '81', flag: '🇯🇵' },
  { code: 'ZA', name: 'South Africa', dial: '27', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', dial: '234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', dial: '254', flag: '🇰🇪' },
  { code: 'BR', name: 'Brazil', dial: '55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', dial: '52', flag: '🇲🇽' },
  { code: 'QA', name: 'Qatar', dial: '974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', dial: '965', flag: '🇰🇼' },
  { code: 'OM', name: 'Oman', dial: '968', flag: '🇴🇲' },
  { code: 'BH', name: 'Bahrain', dial: '973', flag: '🇧🇭' },
];

export const DEFAULT_DIAL_CODE = '91';

/** Dial codes sorted longest-first so detection prefers the most specific match. */
const DIALS_BY_LENGTH = [...new Set(COUNTRIES.map((c) => c.dial))].sort((a, b) => b.length - a.length);

/** Expected national number length by dial code (used for validation UX). */
const NATIONAL_LENGTH: Record<string, number> = { '91': 10 };

export function digitsOnly(input: string): string {
  return (input || '').replace(/\D/g, '');
}

export function findCountryByDial(dial: string): Country | undefined {
  return COUNTRIES.find((c) => c.dial === dial);
}

/**
 * Split a stored/typed phone into { dialCode, national }. If the number begins
 * with a known dial code (and the remainder is a plausible national length) we
 * detect it; otherwise we assume the given default dial code and treat the whole
 * thing as the national part.
 */
export function splitPhone(phone: string, defaultDial: string = DEFAULT_DIAL_CODE): { dialCode: string; national: string } {
  const digits = digitsOnly(phone);
  if (!digits) return { dialCode: defaultDial, national: '' };

  // A number of 10 digits or fewer is a bare national number → keep the default
  // dial code. This avoids mis-splitting a raw 10-digit number that merely
  // starts with a dial-code's digits (e.g. Indian 94xxxxxxxx as +94).
  if (digits.length <= 10) return { dialCode: defaultDial, national: digits };

  // Longer → peel a known dial code, preferring the longest match whose national
  // remainder is a plausible length.
  for (const dial of DIALS_BY_LENGTH) {
    if (!digits.startsWith(dial)) continue;
    const national = digits.slice(dial.length);
    const expected = NATIONAL_LENGTH[dial];
    if (expected ? national.length === expected : national.length >= 6 && national.length <= 12) {
      return { dialCode: dial, national };
    }
  }
  return { dialCode: defaultDial, national: digits };
}

/**
 * Normalize to the canonical full international MSISDN (digits only). `phone`
 * may be a national part or already include the dial code.
 */
export function normalizeWhatsappPhone(phone: string, dialCode: string = DEFAULT_DIAL_CODE): string {
  const digits = digitsOnly(phone);
  const dial = digitsOnly(dialCode) || DEFAULT_DIAL_CODE;
  if (!digits) return '';
  if (digits.startsWith(dial)) {
    // Already prefixed — but guard against a national number that legitimately
    // starts with the dial code digits (India: exactly 10 national digits).
    const expected = NATIONAL_LENGTH[dial];
    if (expected && digits.length === expected) return `${dial}${digits}`;
    return digits;
  }
  return `${dial}${digits}`;
}

/** Validate the NATIONAL part length. India = exactly 10; others 4–14 digits. */
export function isValidNationalNumber(national: string, dialCode: string = DEFAULT_DIAL_CODE): boolean {
  const digits = digitsOnly(national);
  const expected = NATIONAL_LENGTH[dialCode];
  if (expected) return digits.length === expected;
  return digits.length >= 4 && digits.length <= 14;
}
