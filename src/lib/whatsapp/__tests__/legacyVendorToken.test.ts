// src/lib/whatsapp/__tests__/legacyVendorToken.test.ts
//
// The regression net for the audit's worst finding: the WhatsApp vendor API
// token must never reach persistent browser storage again.
//
// It is a tenant-wide, long-lived credential that can read every conversation
// and send as the business. While it lived in `localStorage.celiyo_user`, one
// XSS anywhere in this SPA was a full WhatsApp Business account takeover.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/client', () => ({
  authClient: { get: vi.fn() },
  crmClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  tokenManager: {
    getAccessToken: vi.fn(() => 'jwt'),
    getRefreshToken: vi.fn(() => 'refresh'),
    setAccessToken: vi.fn(),
    setRefreshToken: vi.fn(),
    removeTokens: vi.fn(),
  },
}));

import { authClient } from '@/lib/client';
import {
  getLegacyVendorToken,
  clearLegacyVendorToken,
  peekLegacyVendorToken,
  hasLegacyVendorToken,
  getLegacyVendorUid,
} from '@/lib/whatsapp/legacyVendorToken';

const get = authClient.get as ReturnType<typeof vi.fn>;

const VENDOR_TOKEN = 'vendor-api-token-SUPER-SECRET-abcdef123456';

/** Every write that reaches persistent storage during a test. */
let writes: Array<{ key: string; value: string }> = [];

beforeEach(() => {
  vi.clearAllMocks();
  clearLegacyVendorToken();
  writes = [];
  localStorage.clear();
  sessionStorage.clear();

  // One spy on Storage.prototype covers BOTH localStorage and sessionStorage,
  // so nothing can sneak the token into persistent storage past this test.
  // Reads are stubbed per-test, so we do not need writes to actually land.
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
    writes.push({ key, value });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('legacyVendorToken — persistence', () => {
  it('NEVER writes the vendor token to localStorage or sessionStorage', async () => {
    // Put a user in storage without going through the spied setItem.
    const store: Record<string, string> = {
      celiyo_user: JSON.stringify({ tenant: { id: 'tenant-1' } }),
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => store[k] ?? null);

    get.mockResolvedValueOnce({
      data: { settings: { whatsapp_api_token: VENDOR_TOKEN, whatsapp_vendor_uid: 'v-1' } },
    });

    const token = await getLegacyVendorToken();
    expect(token).toBe(VENDOR_TOKEN);

    // THE assertion: nothing written anywhere contains the token.
    for (const write of writes) {
      expect(write.value).not.toContain(VENDOR_TOKEN);
    }
    expect(writes.some((w) => w.key.includes('whatsapp_api_token'))).toBe(false);
  });

  it('holds the token in memory only, and drops it on clear', async () => {
    const store: Record<string, string> = {
      celiyo_user: JSON.stringify({ tenant: { id: 'tenant-1' } }),
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => store[k] ?? null);

    expect(peekLegacyVendorToken()).toBeNull();
    expect(hasLegacyVendorToken()).toBe(false);

    get.mockResolvedValueOnce({ data: { settings: { whatsapp_api_token: VENDOR_TOKEN } } });
    await getLegacyVendorToken();

    expect(peekLegacyVendorToken()).toBe(VENDOR_TOKEN);
    expect(hasLegacyVendorToken()).toBe(true);

    // Logout must make it unreachable.
    clearLegacyVendorToken();
    expect(peekLegacyVendorToken()).toBeNull();
    expect(hasLegacyVendorToken()).toBe(false);
  });

  it('fetches once and shares the request between concurrent callers', async () => {
    const store: Record<string, string> = {
      celiyo_user: JSON.stringify({ tenant: { id: 'tenant-1' } }),
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => store[k] ?? null);

    get.mockResolvedValue({ data: { settings: { whatsapp_api_token: VENDOR_TOKEN } } });

    const [a, b, c] = await Promise.all([
      getLegacyVendorToken(),
      getLegacyVendorToken(),
      getLegacyVendorToken(),
    ]);

    expect([a, b, c]).toEqual([VENDOR_TOKEN, VENDOR_TOKEN, VENDOR_TOKEN]);
    expect(get).toHaveBeenCalledTimes(1);

    // A fourth call after resolution uses the memory cache.
    await getLegacyVendorToken();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('resolves to null rather than throwing when the fetch fails', async () => {
    const store: Record<string, string> = {
      celiyo_user: JSON.stringify({ tenant: { id: 'tenant-1' } }),
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => store[k] ?? null);

    get.mockRejectedValueOnce(new Error('network down'));
    // An axios interceptor cannot handle a rejection here; it must degrade.
    await expect(getLegacyVendorToken()).resolves.toBeNull();
  });

  it('resolves to null when there is no tenant, without calling the API', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);
    await expect(getLegacyVendorToken()).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('survives a corrupt celiyo_user blob', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => '{not json');
    await expect(getLegacyVendorToken()).resolves.toBeNull();
    expect(getLegacyVendorUid()).toBeNull();
  });
});

describe('legacyVendorToken — vendor uid', () => {
  it('reads the vendor uid from localStorage (it is not a secret)', () => {
    const store: Record<string, string> = {
      celiyo_user: JSON.stringify({ tenant: { whatsapp_vendor_uid: 'vendor-abc' } }),
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => store[k] ?? null);
    expect(getLegacyVendorUid()).toBe('vendor-abc');
  });

  it('falls back through the known vendor-uid locations', () => {
    const store: Record<string, string> = {
      celiyo_user: JSON.stringify({ tenant: { settings: { whatsapp_vendor_uid: 'from-settings' } } }),
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k: string) => store[k] ?? null);
    expect(getLegacyVendorUid()).toBe('from-settings');
  });
});
