// src/context/__tests__/TelephonyProvider.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

// Capture the event handlers piopiy.on(...) registers so we can fire them.
const h = vi.hoisted(() => ({ handlers: {} as Record<string, (p: unknown) => void> }));

vi.mock('piopiyjs', () => {
  class MockPiopiy {
    on(evt: string, cb: (p: unknown) => void) {
      h.handlers[evt] = cb;
    }
    login() {}
    logout() {}
    call() {}
    answer() {}
    reject() {}
    hold() {}
    unHold() {}
    mute() {}
    unMute() {}
    sendDtmf() {}
    transfer() {}
    merge() {}
    terminate() {}
    getCallId() {
      return 'call-1';
    }
  }
  return { default: MockPiopiy };
});

// Stable webrtc-config so the provider creates the instance and lands on needs-password.
vi.mock('@/hooks/useTelephony', () => {
  const config = { telecmi_user_id: '103_111', sbc_host: 'sbcind.telecmi.com', default_caller_id: null };
  return {
    useTelephony: () => ({ useWebRTCConfig: () => ({ data: config, error: undefined }) }),
  };
});

vi.mock('@/hooks/useTelephonyLiveEvents', () => ({
  useTelephonyLiveEvents: () => ({ connected: false, lastEvent: null, recentEvents: [] }),
}));

vi.mock('@/lib/telephonyController', () => ({ setTelephonyDispatcher: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));

import {
  TelephonyProvider,
  useTelephonyPhone,
  type TelephonyPhoneContextValue,
} from '@/context/TelephonyProvider';

let ctx: TelephonyPhoneContextValue;
const Capture = () => {
  ctx = useTelephonyPhone();
  return null;
};

const fire = (evt: string, payload: unknown = {}) =>
  act(() => {
    h.handlers[evt]?.(payload);
  });

describe('TelephonyProvider state machine', () => {
  beforeEach(() => {
    h.handlers = {};
  });

  it('walks login → ready → dial → answered → hangup', () => {
    render(
      <TelephonyProvider>
        <Capture />
      </TelephonyProvider>,
    );

    // config present, not logged in yet
    expect(ctx.status).toBe('needs-password');

    // login() optimistically goes to connecting
    act(() => ctx.login('secret'));
    expect(ctx.status).toBe('connecting');

    // backend confirms login
    fire('login', { code: 200 });
    expect(ctx.status).toBe('ready');

    // place an outbound call
    act(() => ctx.dial({ toNumber: '919000000000', leadId: 42 }));
    expect(ctx.status).toBe('dialling');
    expect(ctx.currentCall).toMatchObject({ number: '919000000000', direction: 'outbound', leadId: 42 });
    expect(ctx.panelOpen).toBe(true);

    // ring then answer
    fire('ringing');
    expect(ctx.status).toBe('ringing-outbound');
    fire('answered');
    expect(ctx.status).toBe('active');

    // hold / unhold
    fire('hold');
    expect(ctx.status).toBe('on-hold');
    fire('unhold');
    expect(ctx.status).toBe('active');

    // hang up resets to ready
    fire('hangup');
    expect(ctx.status).toBe('ready');
    expect(ctx.currentCall).toBeNull();
  });

  it('handles an inbound call: inComingCall → answered → ended', () => {
    render(
      <TelephonyProvider>
        <Capture />
      </TelephonyProvider>,
    );
    fire('login', { code: 200 });
    expect(ctx.status).toBe('ready');

    fire('inComingCall', { from: '918000000000', cmiuid: 'abc-123' });
    expect(ctx.status).toBe('ringing-inbound');
    expect(ctx.currentCall).toMatchObject({ number: '918000000000', direction: 'inbound', cmiuid: 'abc-123' });

    fire('answered');
    expect(ctx.status).toBe('active');

    fire('ended', { code: 200 });
    expect(ctx.status).toBe('ready');
    expect(ctx.currentCall).toBeNull();
  });

  it('returns to needs-password on login failure', () => {
    render(
      <TelephonyProvider>
        <Capture />
      </TelephonyProvider>,
    );
    act(() => ctx.login('wrong'));
    fire('loginFailed', { code: 401 });
    expect(ctx.status).toBe('needs-password');
  });
});
