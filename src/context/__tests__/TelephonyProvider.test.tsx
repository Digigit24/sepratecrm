// src/context/__tests__/TelephonyProvider.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';

// ── shared mutable fixtures ──────────────────────────────────────────────
// `server` is what the mocked webrtc-config endpoint currently answers; tests
// mutate it and then trigger a (re)fetch. `logins` records every credential the
// SDK was handed so we can assert re-login behaviour.
const h = vi.hoisted(() => ({
  handlers: {} as Record<string, (p: unknown) => void>,
  logins: [] as Array<{ user: string; secret: string; host: string }>,
  logouts: 0,
  fetches: 0,
  server: {
    config: undefined as Record<string, unknown> | undefined,
    error: undefined as unknown,
  },
}));

vi.mock('piopiyjs', () => {
  class MockPiopiy {
    on(evt: string, cb: (p: unknown) => void) {
      h.handlers[evt] = cb;
    }
    login(user: string, secret: string, host: string) {
      h.logins.push({ user, secret, host });
    }
    logout() {
      h.logouts += 1;
    }
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

// A miniature stand-in for the SWR-backed useWebRTCConfig: it fetches once when
// enabled, and refetches on mutate() — which is exactly the surface the
// provider's reconnect() drives.
vi.mock('@/hooks/useTelephony', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  type Snap = { data?: unknown; error?: unknown; loaded: boolean };

  const useWebRTCConfig = (enabled = true) => {
    const [snap, setSnap] = React.useState<Snap>({ loaded: false });

    const read = React.useCallback((): Snap => {
      h.fetches += 1;
      return h.server.error
        ? { data: undefined, error: h.server.error, loaded: true }
        : { data: h.server.config, error: undefined, loaded: true };
    }, []);

    React.useEffect(() => {
      if (enabled && !snap.loaded) setSnap(read());
    }, [enabled, snap.loaded, read]);

    const mutate = React.useCallback(async () => {
      const next = read();
      setSnap(next);
      if (next.error) throw next.error;
      return next.data;
    }, [read]);

    return {
      data: enabled ? snap.data : undefined,
      error: enabled ? snap.error : undefined,
      isLoading: enabled && !snap.loaded,
      mutate,
    };
  };

  return {
    useTelephony: () => ({ useWebRTCConfig }),
    isTelephonyMarkedNotConfigured: () => false,
    markTelephonyNotConfigured: vi.fn(),
    clearTelephonyNotConfigured: vi.fn(),
    TELEPHONY_NOT_CONFIGURED_RECHECK_MS: 30_000,
  };
});

vi.mock('@/hooks/useTelephonyLiveEvents', () => ({
  useTelephonyLiveEvents: () => ({ connected: false, lastEvent: null, recentEvents: [] }),
}));

vi.mock('@/lib/telephonyController', () => ({ setTelephonyDispatcher: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { TelephonyApiError } from '@/services/telephonyService';
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

const BASE_CONFIG = {
  telecmi_user_id: '103_111',
  sbc_host: 'sbcind.telecmi.com',
  default_caller_id: null,
};

const notConfigured = (reason: string | null) =>
  new TelephonyApiError({
    isAxiosError: true,
    response: { status: 424, data: reason ? { error: 'nope', reason } : { error: 'nope' } },
    message: 'Request failed with status code 424',
  });

const mount = async () => {
  render(
    <TelephonyProvider>
      <Capture />
    </TelephonyProvider>,
  );
  // let the mocked fetch effect settle
  await act(async () => {});
};

beforeEach(() => {
  h.handlers = {};
  h.logins = [];
  h.logouts = 0;
  h.fetches = 0;
  h.server = { config: { ...BASE_CONFIG }, error: undefined };
  localStorage.clear();
  sessionStorage.clear();
});

describe('TelephonyProvider state machine', () => {
  it('walks login → ready → dial → answered → hangup', async () => {
    await mount();

    // config present, no server-supplied auth => the user must type a password
    expect(ctx.status).toBe('needs-password');
    expect(ctx.hasServerAuth).toBe(false);

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

  it('handles an inbound call: inComingCall → answered → ended', async () => {
    await mount();
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

  it('returns to needs-password on login failure', async () => {
    await mount();
    act(() => ctx.login('wrong'));
    fire('loginFailed', { code: 401 });
    expect(ctx.status).toBe('needs-password');
  });
});

describe('TelephonyProvider server-supplied auth', () => {
  it.each(['token', 'password'] as const)(
    'auto-logs-in with a server %s credential',
    async (kind) => {
      h.server.config = { ...BASE_CONFIG, auth: { kind, value: 'sekrit-value' } };
      await mount();

      await waitFor(() => expect(h.logins).toHaveLength(1));
      // both kinds go into the same piopiy.login() slot
      expect(h.logins[0]).toEqual({
        user: '103_111',
        secret: 'sekrit-value',
        host: 'sbcind.telecmi.com',
      });
      expect(ctx.status).toBe('connecting');
      expect(ctx.hasServerAuth).toBe(true);

      fire('login', { code: 200 });
      expect(ctx.status).toBe('ready');
    },
  );

  it('degrades to the password form when the backend has not shipped `auth`', async () => {
    h.server.config = { ...BASE_CONFIG };
    await mount();
    await act(async () => {});

    expect(h.logins).toHaveLength(0);
    expect(ctx.hasServerAuth).toBe(false);
    expect(ctx.status).toBe('needs-password');
  });

  it('ignores a malformed `auth` object instead of crashing', async () => {
    h.server.config = { ...BASE_CONFIG, auth: { kind: 'token' } }; // no value
    await mount();
    await act(async () => {});

    expect(h.logins).toHaveLength(0);
    expect(ctx.hasServerAuth).toBe(false);
    expect(ctx.status).toBe('needs-password');
  });

  it('tries the server credential exactly once — a rejection is not a retry loop', async () => {
    h.server.config = { ...BASE_CONFIG, auth: { kind: 'token', value: 'bad' } };
    await mount();

    await waitFor(() => expect(h.logins).toHaveLength(1));
    fire('loginFailed', { code: 401 });
    expect(ctx.status).toBe('needs-password');

    await act(async () => {});
    expect(h.logins).toHaveLength(1); // still one — retry is explicit
  });

  it('never writes the credential to localStorage or sessionStorage', async () => {
    h.server.config = { ...BASE_CONFIG, auth: { kind: 'token', value: 'super-secret-token' } };
    await mount();
    await waitFor(() => expect(h.logins).toHaveLength(1));
    fire('login', { code: 200 });

    const dump = (s: Storage) =>
      Object.keys(s)
        .map((k) => `${k}=${s.getItem(k) ?? ''}`)
        .join('\n');

    expect(dump(localStorage)).not.toContain('super-secret-token');
    expect(dump(sessionStorage)).not.toContain('super-secret-token');
    // and nothing at all was persisted by the softphone path
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe('TelephonyProvider reconnect()', () => {
  it('re-fetches webrtc-config and re-logs-in with the new values', async () => {
    h.server.config = { ...BASE_CONFIG, auth: { kind: 'token', value: 'old-token' } };
    await mount();
    await waitFor(() => expect(h.logins).toHaveLength(1));
    fire('login', { code: 200 });
    expect(ctx.status).toBe('ready');

    const fetchesBefore = h.fetches;

    // settings saved: a different extension + credential
    h.server.config = {
      telecmi_user_id: '104_222',
      sbc_host: 'sbcsg.telecmi.com',
      default_caller_id: '918000000000',
      auth: { kind: 'password', value: 'new-password' },
    };

    await act(async () => {
      await ctx.reconnect();
    });

    // it re-fetched…
    expect(h.fetches).toBeGreaterThan(fetchesBefore);
    // …tore the old session down before opening a new one…
    expect(h.logouts).toBe(1);
    // …and re-logged-in with the NEW values, without a reload or re-login.
    await waitFor(() => expect(h.logins).toHaveLength(2));
    expect(h.logins[1]).toEqual({
      user: '104_222',
      secret: 'new-password',
      host: 'sbcsg.telecmi.com',
    });
    expect(ctx.telecmiUserId).toBe('104_222');
    expect(ctx.defaultCallerId).toBe('918000000000');
  });

  it('never stacks two sessions: logout precedes the new login', async () => {
    h.server.config = { ...BASE_CONFIG, auth: { kind: 'token', value: 't1' } };
    await mount();
    await waitFor(() => expect(h.logins).toHaveLength(1));
    fire('login', { code: 200 });

    h.server.config = { ...BASE_CONFIG, auth: { kind: 'token', value: 't2' } };
    await act(async () => {
      await ctx.reconnect();
    });
    await waitFor(() => expect(h.logins).toHaveLength(2));

    expect(h.logouts).toBe(1);
    expect(h.logins.map((l) => l.secret)).toEqual(['t1', 't2']);
  });

  it('leaves a retryable state (not a stuck spinner) when the reconnect fails', async () => {
    h.server.config = { ...BASE_CONFIG, auth: { kind: 'token', value: 't1' } };
    await mount();
    await waitFor(() => expect(h.logins).toHaveLength(1));
    fire('login', { code: 200 });

    h.server.config = undefined;
    h.server.error = notConfigured('no_agent');

    await act(async () => {
      await ctx.reconnect(); // must not throw
    });

    await waitFor(() => expect(ctx.status).toBe('not-configured'));
    expect(ctx.status).not.toBe('loading');
    expect(ctx.notConfiguredReason).toBe('no_agent');

    // …and a later retry recovers in place
    h.server.error = undefined;
    h.server.config = { ...BASE_CONFIG, auth: { kind: 'token', value: 't2' } };
    await act(async () => {
      await ctx.reconnect();
    });
    await waitFor(() => expect(ctx.status).toBe('connecting'));
    expect(h.logins[h.logins.length - 1].secret).toBe('t2');
  });
});

describe('TelephonyProvider 424 reasons', () => {
  it.each([
    ['tenant_not_configured', "Telephony isn't set up for this workspace yet"],
    ['no_agent', 'Your account has no TeleCMI extension'],
  ] as const)('surfaces %s distinctly', async (reason, expectedMessage) => {
    h.server.config = undefined;
    h.server.error = notConfigured(reason);

    await mount();
    await waitFor(() => expect(ctx.status).toBe('not-configured'));

    expect(ctx.notConfiguredReason).toBe(reason);
    expect(ctx.telephonyConfigurationError).toBe(expectedMessage);
    expect(ctx.isTelephonyConfigured).toBe(false);
  });

  it('falls back to generic copy when the 424 carries no reason', async () => {
    h.server.config = undefined;
    h.server.error = notConfigured(null);

    await mount();
    await waitFor(() => expect(ctx.status).toBe('not-configured'));

    expect(ctx.notConfiguredReason).toBeNull();
    expect(ctx.telephonyConfigurationError).toBe('Set up telephony in Settings');
  });

  it('does not sit on a spinner when the config request fails for another reason', async () => {
    h.server.config = undefined;
    h.server.error = new Error('boom');

    await mount();
    await waitFor(() => expect(ctx.status).toBe('not-configured'));
    expect(ctx.notConfiguredReason).toBeNull();
    expect(ctx.telephonyConfigurationError).toBe('boom');
  });
});

describe('TelephonyProvider tenant-default identity', () => {
  it('exposes source: tenant so the UI can say which identity is in use', async () => {
    h.server.config = { ...BASE_CONFIG, source: 'tenant', auth: { kind: 'token', value: 't' } };
    await mount();
    await waitFor(() => expect(ctx.configSource).toBe('tenant'));
  });

  it('exposes source: user for a per-user extension', async () => {
    h.server.config = { ...BASE_CONFIG, source: 'user' };
    await mount();
    await waitFor(() => expect(ctx.configSource).toBe('user'));
  });

  it('exposes null when the backend has not shipped `source`', async () => {
    h.server.config = { ...BASE_CONFIG };
    await mount();
    await act(async () => {});
    expect(ctx.configSource).toBeNull();
  });
});
