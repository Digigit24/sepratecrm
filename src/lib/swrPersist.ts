// src/lib/swrPersist.ts
//
// localStorage-backed cache provider for SWR.
//
// WHY
// ---
// The user directory (`['user-directory']`) is master data that every leads /
// tasks / telephony screen needs in order to turn an owner/assignee UUID into
// a human name. Without persistence, a cold start paints raw skeletons (and,
// before this layer existed, raw UUIDs) until the network resolves.
//
// SWR v2 accepts a custom `provider` on <SWRConfig>. This module returns a Map
// seeded from localStorage and flushed back on `beforeunload` (plus on
// `visibilitychange`, because mobile browsers frequently skip `beforeunload`).
//
// SAFETY RULES
// ------------
//  - ALLOWLIST ONLY. Only keys in PERSISTED_KEY_PREFIXES are written to disk.
//    Leads, contacts, messages and anything else with PII never touch storage.
//  - TENANT SCOPED. The snapshot records the tenant id it was written under and
//    is discarded wholesale if the current tenant differs (user switched
//    tenants / logged in as somebody else).
//  - VERSIONED + TTL. Bump SCHEMA_VERSION to invalidate every client. Snapshots
//    older than MAX_AGE_MS are dropped.
//  - NEVER THROWS. Storage can be full, disabled, or contain garbage from an
//    older build; every step is individually guarded.

const CACHE_KEY = 'celiyo_swr_cache';
const USER_KEY = 'celiyo_user';
const SCHEMA_VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Only SWR keys starting with one of these prefixes are persisted.
 * Keep this list tiny and PII-free.
 */
const PERSISTED_KEY_PREFIXES = ['user-directory'];

interface PersistedSnapshot {
  v: number;
  tenantId: string | null;
  ts: number;
  entries: Array<[string, unknown]>;
}

/** Tenant id of the currently stored user, or null. */
function currentTenantId(): string | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    const tenant = user?.tenant;
    if (!tenant) return null;
    return (tenant.id || tenant.tenant_id || null) as string | null;
  } catch {
    return null;
  }
}

function isPersistable(key: unknown): key is string {
  return typeof key === 'string' && PERSISTED_KEY_PREFIXES.some((p) => key.startsWith(p));
}

/** Read + validate the persisted snapshot. Returns [] when unusable. */
function readSnapshot(): Array<[string, unknown]> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as PersistedSnapshot;
    if (!parsed || typeof parsed !== 'object') return [];
    if (parsed.v !== SCHEMA_VERSION) return [];
    if (!Array.isArray(parsed.entries)) return [];

    // Tenant switch => the previous tenant's names must never be shown.
    if (parsed.tenantId !== currentTenantId()) return [];

    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > MAX_AGE_MS) return [];

    return parsed.entries.filter(
      (e) => Array.isArray(e) && e.length === 2 && isPersistable(e[0])
    );
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeSnapshot(map: Map<string, any>): void {
  try {
    const entries: Array<[string, unknown]> = [];
    map.forEach((value, key) => {
      if (!isPersistable(key)) return;
      // SWR stores { data, error, isValidating, isLoading, _c }. Only `data`
      // is worth persisting — an error or an in-flight flag must not survive
      // a reload.
      const state = value as { data?: unknown; error?: unknown };
      if (!state || typeof state !== 'object') return;
      if (state.error !== undefined || state.data === undefined) return;
      entries.push([key, { data: state.data }]);
    });

    if (entries.length === 0) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }

    const snapshot: PersistedSnapshot = {
      v: SCHEMA_VERSION,
      tenantId: currentTenantId(),
      ts: Date.now(),
      entries,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // QuotaExceeded / storage disabled — persistence is a nicety, never fatal.
  }
}

/**
 * SWR `provider`. Returns a Map seeded from localStorage that flushes the
 * allowlisted entries back on unload.
 *
 * Usage: <SWRConfig value={{ ...swrConfig, provider: createPersistentSWRCache }}>
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPersistentSWRCache(): Map<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map<string, any>(readSnapshot());

  if (typeof window !== 'undefined') {
    const flush = () => writeSnapshot(map);
    window.addEventListener('beforeunload', flush);
    // beforeunload is unreliable on mobile Safari/Chrome; pagehide + hidden
    // are the recommended companions.
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  return map;
}

/**
 * Drop the persisted snapshot. Called on logout / token wipe so a subsequent
 * user can never see the previous user's directory.
 */
export function clearPersistentSWRCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* no-op */
  }
}
