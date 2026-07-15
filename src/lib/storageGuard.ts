// src/lib/storageGuard.ts
//
// Boot-time migration + validation of persisted browser data.
//
// WHY THIS EXISTS
// ---------------
// After a deploy, some production users could only load the app after
// manually running localStorage.clear(). Root cause: legacy/malformed
// persisted values reached unguarded consumers:
//
//   1. `celiyo-theme` is read RAW by next-themes, which calls
//      document.documentElement.classList.add(<value>). Any value that is
//      not a valid single CSS class token (empty string, JSON-quoted
//      strings like `"dark"`, `[object Object]`, JSON objects — anything
//      with spaces/quotes) throws SyntaxError / InvalidCharacterError
//      inside a React effect and white-screens the whole app.
//   2. `celiyo_user.preferences.theme` written by older builds could be a
//      legacy string variant or an object; ThemeSync piped it verbatim
//      into next-themes' setTheme(), which then PERSISTED the bad value
//      into `celiyo-theme` — so the app kept crashing on every subsequent
//      load until storage was cleared.
//   3. `celiyo_user` could be JSON-valid but the wrong shape (number,
//      string, array), or `preferences` could be a non-object.
//   4. `crm_lead_statuses` written by older builds as a plain array
//      (current shape: { data: [], timestamp: number }).
//
// This module runs BEFORE React renders (imported from main.tsx) and:
//   - migrates every recoverable legacy value to the current format,
//   - removes anything unrecoverable so code falls back to safe defaults,
//   - guarantees nothing invalid can reach classList.add/toggle,
//   - never throws itself (every step individually guarded).
//
// KEYS COVERED
// ------------
//   theme / appearance : 'celiyo-theme' (next-themes), legacy 'theme',
//                        legacy 'vite-ui-theme' (shadcn default)
//   user settings      : 'celiyo_user' (includes `preferences` object:
//                        theme + whatsappDefaults + crmLeadsFilterConfig)
//   preferences cache  : 'crm_lead_statuses'
//   UI prefs           : '*-drawer-width' / 'sidedrawer-width-*' (numeric)
//   legacy auth keys   : 'accessToken', 'refreshToken', 'user' (pre-celiyo
//                        naming) — migrated to celiyo_* when those are empty
//   sessionStorage     : any 'celiyo*' / 'crm_*' entry that claims to be
//                        JSON but doesn't parse is removed

const THEME_KEY = 'celiyo-theme';
const LEGACY_THEME_KEYS = ['theme', 'vite-ui-theme'];
const USER_KEY = 'celiyo_user';
const ACCESS_TOKEN_KEY = 'celiyo_access_token';
const REFRESH_TOKEN_KEY = 'celiyo_refresh_token';
const LEAD_STATUS_CACHE_KEY = 'crm_lead_statuses';
const STORAGE_VERSION_KEY = 'celiyo_storage_version';
const STORAGE_VERSION = '2';

export type SafeTheme = 'light' | 'dark';

/** Values that indicate a corrupted write from an old build. */
const GARBAGE_LITERALS = new Set(['undefined', 'null', 'NaN', '[object Object]']);

/**
 * Coerce ANY legacy/current theme representation to 'light' | 'dark'.
 * Returns null when the value is unrecognizable (caller must fall back).
 * Accepts:  'dark' | 'light' | 'system' | '"dark"' (JSON-quoted) |
 *           {theme:'dark'} | {mode:'dark'} | {value:'dark'} | 'DARK' etc.
 */
export function sanitizeThemeValue(raw: unknown, depth = 0): SafeTheme | null {
  if (depth > 3 || raw == null) return null;

  if (typeof raw === 'string') {
    let v = raw.trim();
    if (!v || GARBAGE_LITERALS.has(v)) return null;

    // Legacy builds JSON.stringify'd the theme → `"dark"` (with quotes),
    // or persisted a whole JSON object into the theme key.
    if ((v.startsWith('"') && v.endsWith('"')) || v.startsWith('{') || v.startsWith('[')) {
      try {
        return sanitizeThemeValue(JSON.parse(v), depth + 1);
      } catch {
        // Strip stray quotes as a last resort
        v = v.replace(/^"+|"+$/g, '').trim();
      }
    }

    const lower = v.toLowerCase();
    if (lower === 'dark') return 'dark';
    if (lower === 'light') return 'light';
    // enableSystem is false in ThemeProvider → map 'system' to the default
    if (lower === 'system') return 'light';
    return null;
  }

  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return (
      sanitizeThemeValue(o.theme, depth + 1) ??
      sanitizeThemeValue(o.mode, depth + 1) ??
      sanitizeThemeValue(o.value, depth + 1) ??
      sanitizeThemeValue(o.appearance, depth + 1)
    );
  }

  return null;
}

/** True when a string is a single valid CSS class token (classList-safe). */
function isSafeClassToken(v: string): boolean {
  return v.length > 0 && !/[\s"'<>`]/.test(v);
}

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    /* quota / privacy mode — ignore */
  }
}

function safeRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Validate/migrate the next-themes key. GUARANTEE after this runs:
 * `celiyo-theme` is either absent (next-themes falls back to defaultTheme
 * 'light') or exactly 'light'/'dark' — always a classList-safe token.
 */
function migrateThemeKey(): void {
  let raw = safeGet(localStorage, THEME_KEY);
  let adoptedFromLegacy = false;

  // If the current key is empty, adopt a value from legacy theme keys.
  if (raw == null || raw === '') {
    for (const legacyKey of LEGACY_THEME_KEYS) {
      const legacy = safeGet(localStorage, legacyKey);
      if (legacy != null && legacy !== '') {
        raw = legacy;
        adoptedFromLegacy = true;
        break;
      }
    }
  }
  // Legacy keys are no longer read by anything — always drop them.
  for (const legacyKey of LEGACY_THEME_KEYS) safeRemove(localStorage, legacyKey);

  if (raw == null) return;

  const sanitized = sanitizeThemeValue(raw);
  if (sanitized && isSafeClassToken(sanitized)) {
    // Write when the value changed OR when it was adopted from a legacy key
    if (raw !== sanitized || adoptedFromLegacy) {
      safeSet(localStorage, THEME_KEY, sanitized);
    }
  } else if (!adoptedFromLegacy) {
    safeRemove(localStorage, THEME_KEY); // unrecoverable → default 'light'
  }
}

/**
 * Validate/migrate the persisted user object. GUARANTEE after this runs:
 * `celiyo_user` is either absent (app routes to /login) or a JSON object
 * whose `preferences` is a plain object and whose `preferences.theme`,
 * if present, is exactly 'light'/'dark'.
 */
function migrateUserKey(): void {
  const raw = safeGet(localStorage, USER_KEY);
  if (raw == null) return;

  if (raw === '' || GARBAGE_LITERALS.has(raw.trim())) {
    safeRemove(localStorage, USER_KEY);
    return;
  }

  let user: unknown;
  try {
    user = JSON.parse(raw);
  } catch {
    // Not JSON at all — unrecoverable; removing it simply sends the user
    // through login again instead of crashing every consumer.
    safeRemove(localStorage, USER_KEY);
    return;
  }

  // JSON-valid but wrong shape (number, string, boolean, array) → remove.
  if (typeof user !== 'object' || user === null || Array.isArray(user)) {
    safeRemove(localStorage, USER_KEY);
    return;
  }

  const u = user as Record<string, unknown>;
  let changed = false;

  // preferences must be a plain object
  if (u.preferences == null || typeof u.preferences !== 'object' || Array.isArray(u.preferences)) {
    if (u.preferences !== undefined) changed = true;
    u.preferences = {};
  }

  // preferences.theme: migrate legacy variants, drop the unrecognizable
  const prefs = u.preferences as Record<string, unknown>;
  if (prefs.theme !== undefined) {
    const sanitized = sanitizeThemeValue(prefs.theme);
    if (sanitized === null) {
      delete prefs.theme;
      changed = true;
    } else if (prefs.theme !== sanitized) {
      prefs.theme = sanitized;
      changed = true;
    }
  }

  if (changed) {
    try {
      safeSet(localStorage, USER_KEY, JSON.stringify(u));
    } catch {
      safeRemove(localStorage, USER_KEY);
    }
  }
}

/** Legacy pre-`celiyo_*` auth keys: adopt if current keys are empty, then drop. */
function migrateLegacyAuthKeys(): void {
  const pairs: Array<[legacy: string, current: string]> = [
    ['accessToken', ACCESS_TOKEN_KEY],
    ['refreshToken', REFRESH_TOKEN_KEY],
    ['user', USER_KEY],
  ];
  for (const [legacy, current] of pairs) {
    const legacyVal = safeGet(localStorage, legacy);
    if (legacyVal && !safeGet(localStorage, current)) {
      safeSet(localStorage, current, legacyVal);
    }
    safeRemove(localStorage, legacy);
  }
}

/** Lead-status cache: it's a 1h cache — anything off-shape is just removed. */
function migrateLeadStatusCache(): void {
  const raw = safeGet(localStorage, LEAD_STATUS_CACHE_KEY);
  if (raw == null) return;
  try {
    const parsed = JSON.parse(raw);
    // Legacy shape: plain array of statuses → wrap in the current envelope
    if (Array.isArray(parsed)) {
      safeSet(
        localStorage,
        LEAD_STATUS_CACHE_KEY,
        JSON.stringify({ data: parsed, timestamp: Date.now() })
      );
      return;
    }
    const ok =
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as any).data) &&
      typeof (parsed as any).timestamp === 'number';
    if (!ok) safeRemove(localStorage, LEAD_STATUS_CACHE_KEY);
  } catch {
    safeRemove(localStorage, LEAD_STATUS_CACHE_KEY);
  }
}

/** Drawer-width keys must be plain integer strings within sane bounds. */
function migrateDrawerWidthKeys(): void {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.endsWith('-drawer-width') || k.startsWith('sidedrawer-width-'))) {
        keys.push(k);
      }
    }
  } catch {
    return;
  }
  for (const k of keys) {
    const v = safeGet(localStorage, k);
    if (v == null) continue;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || String(n) !== v.trim() || n <= 0 || n > 10000) {
      safeRemove(localStorage, k);
    }
  }
}

/** sessionStorage: remove app-namespaced entries that are corrupted JSON. */
function migrateSessionStorage(): void {
  const keys: string[] = [];
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith('celiyo') || k.startsWith('crm_'))) keys.push(k);
    }
  } catch {
    return;
  }
  for (const k of keys) {
    const v = safeGet(sessionStorage, k);
    if (v == null) continue;
    if (GARBAGE_LITERALS.has(v.trim())) {
      safeRemove(sessionStorage, k);
      continue;
    }
    const t = v.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        JSON.parse(t);
      } catch {
        safeRemove(sessionStorage, k);
      }
    }
  }
}

/** Any app-namespaced localStorage entry holding a known garbage literal. */
function sweepGarbageLiterals(): void {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('celiyo') || k.startsWith('crm_'))) keys.push(k);
    }
  } catch {
    return;
  }
  for (const k of keys) {
    const v = safeGet(localStorage, k);
    if (v != null && GARBAGE_LITERALS.has(v.trim())) safeRemove(localStorage, k);
  }
}

/**
 * Run all migrations/validations. Called from main.tsx BEFORE React renders.
 * Cheap (a handful of keys) and re-runs every boot so storage self-heals even
 * if something writes a bad value later. Never throws.
 */
export function runStorageGuard(): void {
  try {
    if (typeof window === 'undefined' || !('localStorage' in window)) return;

    migrateLegacyAuthKeys();
    migrateThemeKey();
    migrateUserKey();
    migrateLeadStatusCache();
    migrateDrawerWidthKeys();
    migrateSessionStorage();
    sweepGarbageLiterals();

    safeSet(localStorage, STORAGE_VERSION_KEY, STORAGE_VERSION);
  } catch {
    // A storage guard failure must NEVER block the app from booting.
    // Worst case the old behavior (unvalidated values) applies.
  }
}
