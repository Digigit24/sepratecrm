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
import { telephonyService, TelephonyApiError } from '@/services/telephonyService';

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
