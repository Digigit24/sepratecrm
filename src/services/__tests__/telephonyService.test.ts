// src/services/__tests__/telephonyService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the axios client the service depends on.
vi.mock('@/lib/client', () => ({
  crmClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  tokenManager: {},
}));

import { crmClient } from '@/lib/client';
import {
  telephonyService,
  TelephonyApiError,
  isTelephonyEndpointUnavailable,
} from '@/services/telephonyService';

const get = crmClient.get as ReturnType<typeof vi.fn>;
const post = crmClient.post as ReturnType<typeof vi.fn>;

const axiosError = (status: number, data: unknown) => ({
  isAxiosError: true,
  response: { status, data },
  message: `Request failed with status code ${status}`,
});

describe('telephonyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data on a successful webrtc-config fetch', async () => {
    const config = { telecmi_user_id: '103_111', sbc_host: 'sbcind.telecmi.com', default_caller_id: null };
    get.mockResolvedValueOnce({ data: config });
    await expect(telephonyService.getWebRTCConfig()).resolves.toEqual(config);
  });

  it('normalises a webrtc-config that carries auth + source', async () => {
    get.mockResolvedValueOnce({
      data: {
        telecmi_user_id: '103_1111112',
        sbc_host: 'sbcind.telecmi.com',
        default_caller_id: null,
        auth: { kind: 'token', value: 'tok' },
        source: 'tenant',
      },
    });
    await expect(telephonyService.getWebRTCConfig()).resolves.toEqual({
      telecmi_user_id: '103_1111112',
      sbc_host: 'sbcind.telecmi.com',
      default_caller_id: null,
      auth: { kind: 'token', value: 'tok' },
      source: 'tenant',
    });
  });

  // The backend split the single 'tenant' source into four values. All of them
  // (plus the deprecated alias) have to survive normalisation, because the two
  // repos deploy independently.
  it.each(['user', 'assigned_profile', 'tenant_profile', 'tenant_default', 'tenant'])(
    'keeps the webrtc-config source %s',
    async (source) => {
      get.mockResolvedValueOnce({
        data: { telecmi_user_id: '103_1', sbc_host: 'sbcind.telecmi.com', source },
      });
      await expect(telephonyService.getWebRTCConfig()).resolves.toMatchObject({ source });
    },
  );

  it('drops a source value this build does not know rather than passing it through', async () => {
    get.mockResolvedValueOnce({
      data: { telecmi_user_id: '103_1', sbc_host: 'sbcind.telecmi.com', source: 'from_the_future' },
    });
    await expect(telephonyService.getWebRTCConfig()).resolves.toMatchObject({
      source: undefined,
    });
  });

  it('accepts auth.kind "password" the same way as "token"', async () => {
    get.mockResolvedValueOnce({
      data: {
        telecmi_user_id: '103_1111112',
        sbc_host: 'sbcind.telecmi.com',
        default_caller_id: null,
        auth: { kind: 'password', value: 'pw' },
        source: 'user',
      },
    });
    const cfg = await telephonyService.getWebRTCConfig();
    expect(cfg.auth).toEqual({ kind: 'password', value: 'pw' });
    expect(cfg.source).toBe('user');
  });

  it('drops a malformed auth/source instead of propagating it', async () => {
    get.mockResolvedValueOnce({
      data: {
        telecmi_user_id: '103_1111112',
        sbc_host: 'sbcind.telecmi.com',
        default_caller_id: null,
        auth: { kind: 'magic', value: 123 },
        source: 'somewhere-else',
      },
    });
    const cfg = await telephonyService.getWebRTCConfig();
    expect(cfg.auth).toBeUndefined();
    expect(cfg.source).toBeUndefined();
    // the usable parts still survive — the UI must not white-screen
    expect(cfg.telecmi_user_id).toBe('103_1111112');
  });

  it('parses the 424 reason so the UI can tell the two states apart', async () => {
    get.mockRejectedValueOnce(axiosError(424, { error: 'x', reason: 'tenant_not_configured' }));
    await expect(telephonyService.getWebRTCConfig()).rejects.toMatchObject({
      notConfiguredReason: 'tenant_not_configured',
    });

    get.mockRejectedValueOnce(axiosError(424, { error: 'x', reason: 'no_agent' }));
    await expect(telephonyService.getWebRTCConfig()).rejects.toMatchObject({
      notConfiguredReason: 'no_agent',
    });
  });

  it('nulls an unknown or missing 424 reason', async () => {
    get.mockRejectedValueOnce(axiosError(424, { error: 'x', reason: 'who_knows' }));
    await expect(telephonyService.getWebRTCConfig()).rejects.toMatchObject({
      notConfiguredReason: null,
    });

    get.mockRejectedValueOnce(axiosError(424, { error: 'x' }));
    await expect(telephonyService.getWebRTCConfig()).rejects.toMatchObject({
      notConfiguredReason: null,
    });
  });

  it('flags 424 as isNotConfigured', async () => {
    get.mockRejectedValueOnce(axiosError(424, { detail: 'not configured' }));
    await expect(telephonyService.getWebRTCConfig()).rejects.toMatchObject({
      isNotConfigured: true,
      isUpstreamError: false,
      status: 424,
    });
    // and it is the normalized error type
    await get.mockRejectedValueOnce(axiosError(424, {}));
    try {
      await telephonyService.getWebRTCConfig();
    } catch (e) {
      expect(e).toBeInstanceOf(TelephonyApiError);
    }
  });

  it('flags 502 as isUpstreamError and surfaces the backend error string', async () => {
    post.mockRejectedValueOnce(axiosError(502, { error: 'Invalid user token', sms_log_id: 5 }));
    try {
      await telephonyService.sendSMS({ to_number: '919000000000', message: 'hi' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TelephonyApiError);
      const err = e as TelephonyApiError;
      expect(err.isUpstreamError).toBe(true);
      expect(err.isNotConfigured).toBe(false);
      expect(err.backendError).toBe('Invalid user token');
      // raw body preserved so callers can read sms_log_id
      expect((err.data as { sms_log_id?: number }).sms_log_id).toBe(5);
    }
  });

  it('captures DRF field errors on 400', async () => {
    post.mockRejectedValueOnce(axiosError(400, { to_number: ['This field is required.'] }));
    try {
      await telephonyService.clickToCall({ to_number: '' });
      throw new Error('should have thrown');
    } catch (e) {
      const err = e as TelephonyApiError;
      expect(err.fieldErrors?.to_number?.[0]).toBe('This field is required.');
    }
  });
});

// ==================== CALLING PROFILES (admin) ====================
// These endpoints are being built on the Django side in parallel with the UI,
// so "the route does not exist" is a first-class, expected outcome here.

describe('telephonyService — calling profiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const patch = crmClient.patch as ReturnType<typeof vi.fn>;
  const del = crmClient.delete as ReturnType<typeof vi.fn>;

  it('accepts both a bare array and a DRF page for the profile list', async () => {
    const rows = [{ id: 1, label: 'Sales line' }];
    get.mockResolvedValueOnce({ data: rows });
    await expect(telephonyService.getCallingProfiles()).resolves.toEqual(rows);

    get.mockResolvedValueOnce({ data: { count: 1, next: null, previous: null, results: rows } });
    await expect(telephonyService.getCallingProfiles()).resolves.toEqual(rows);
  });

  it('never invents a profile list out of a malformed body', async () => {
    get.mockResolvedValueOnce({ data: null });
    await expect(telephonyService.getCallingProfiles()).resolves.toEqual([]);
  });

  it('sends the write-only password straight through on create', async () => {
    post.mockResolvedValueOnce({ data: { id: 3, has_password: true } });
    await telephonyService.createCallingProfile({
      label: 'Sales line',
      telecmi_user_id: '103_1111112',
      password: 'extension-pw',
    });
    const [, body] = post.mock.calls[0];
    expect(body.password).toBe('extension-pw');
  });

  it('normalises a verify response, including a half-built body', async () => {
    post.mockResolvedValueOnce({ data: { ok: true, error: null } });
    await expect(telephonyService.verifyCallingProfile(1)).resolves.toEqual({
      ok: true,
      error: null,
    });

    post.mockResolvedValueOnce({ data: {} });
    await expect(telephonyService.verifyCallingProfile(1)).resolves.toEqual({
      ok: false,
      error: null,
    });

    post.mockResolvedValueOnce({ data: { ok: false, error: 'SBC rejected password' } });
    await expect(telephonyService.verifyCallingProfile(1)).resolves.toEqual({
      ok: false,
      error: 'SBC rejected password',
    });
  });

  it('puts the user_id in the request BODY when unassigning (axios needs `data`)', async () => {
    del.mockResolvedValueOnce({ data: {} });
    await telephonyService.unassignCallingProfile(4, 'user-uuid');
    expect(del).toHaveBeenCalledWith('/telephony/calling-profiles/4/assign/', {
      data: { user_id: 'user-uuid' },
    });
  });

  it('patches only the fields it is given', async () => {
    patch.mockResolvedValueOnce({ data: { id: 4 } });
    await telephonyService.updateCallingProfile(4, { label: 'Support line' });
    expect(patch).toHaveBeenCalledWith('/telephony/calling-profiles/4/', {
      label: 'Support line',
    });
  });

  it.each([404, 501, 502, 503])(
    'flags %i as "endpoint not deployed yet" so the UI can degrade calmly',
    async (status) => {
      get.mockRejectedValueOnce(axiosError(status, {}));
      try {
        await telephonyService.getCallingProfiles();
        throw new Error('should have thrown');
      } catch (e) {
        expect(isTelephonyEndpointUnavailable(e)).toBe(true);
      }
    },
  );

  it('does NOT flag a 403 or a 424 as "not deployed"', async () => {
    for (const status of [403, 424]) {
      get.mockRejectedValueOnce(axiosError(status, {}));
      try {
        await telephonyService.getCallingProfiles();
        throw new Error('should have thrown');
      } catch (e) {
        expect(isTelephonyEndpointUnavailable(e)).toBe(false);
      }
    }
  });
});
