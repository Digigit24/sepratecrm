// src/lib/__tests__/telephonyController.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the service so no real HTTP happens.
vi.mock('@/services/telephonyService', () => {
  class TelephonyApiError extends Error {}
  return {
    telephonyService: {
      clickToCall: vi.fn().mockResolvedValue({ code: 200, msg: 'Call initiated', request_id: 'r1' }),
    },
    TelephonyApiError,
  };
});

// toastTelephonyError lives in the hooks module; stub it (and avoid loading SWR).
vi.mock('@/hooks/useTelephony', () => ({
  toastTelephonyError: vi.fn(),
}));

// Silence toasts.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { placeCall, setTelephonyDispatcher } from '@/lib/telephonyController';
import { telephonyService } from '@/services/telephonyService';

const clickToCall = telephonyService.clickToCall as ReturnType<typeof vi.fn>;

describe('placeCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTelephonyDispatcher(null); // ensure clean slate
  });

  it('falls back to REST click-to-call when no dispatcher is registered', async () => {
    const ok = await placeCall({ toNumber: '+91 90000 00000', leadId: 42 });
    expect(ok).toBe(true);
    expect(clickToCall).toHaveBeenCalledTimes(1);
    // number is normalized to digits-only
    expect(clickToCall).toHaveBeenCalledWith({ to_number: '919000000000', lead_id: 42, caller_id: undefined });
  });

  it('routes to the in-browser dispatcher when it is registered and ready', async () => {
    const dispatcherCall = vi.fn().mockReturnValue(true);
    setTelephonyDispatcher({ getStatus: () => 'ready', call: dispatcherCall });

    const ok = await placeCall({ toNumber: '919000000000', leadId: 7 });
    expect(ok).toBe(true);
    expect(dispatcherCall).toHaveBeenCalledWith({ toNumber: '919000000000', leadId: 7 });
    expect(clickToCall).not.toHaveBeenCalled(); // REST skipped
  });

  it('uses REST when the dispatcher exists but is not ready', async () => {
    setTelephonyDispatcher({ getStatus: () => 'active', call: vi.fn() });
    const ok = await placeCall({ toNumber: '919000000000' });
    expect(ok).toBe(true);
    expect(clickToCall).toHaveBeenCalledTimes(1);
  });

  it('returns false and skips calling for an empty number', async () => {
    const ok = await placeCall({ toNumber: '' });
    expect(ok).toBe(false);
    expect(clickToCall).not.toHaveBeenCalled();
  });
});
