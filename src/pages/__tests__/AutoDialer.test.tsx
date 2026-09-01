// Regression tests for the embed route's auto-dial.
//
// The bug these exist for was invisible to every static check: both halves of
// the feature were correct in isolation, and the failure was an EFFECT
// ORDERING race between them.
//
// `dial()` gates on `statusRef.current`, but TelephonyProvider syncs that ref
// inside its own `useEffect`. React runs child effects before parent effects,
// so on the render where `status` first flips to 'ready', the ref still holds
// the previous value. The child called dial(), dial() returned silently, and
// the old implementation had already marked itself done — so it never retried.
// No error, no state change, just a keypad sitting there while the host app's
// header said "Calling …".
//
// The harness below reproduces that ordering deliberately: `status` (state)
// and `statusRef` (lagging ref) are separate, and the ref only catches up
// after a flush — exactly like the real provider.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  status: 'connecting' as string,
  currentCall: null as unknown,
  /** Lags `status`, like the provider's ref synced in a parent useEffect. */
  statusRef: { current: 'connecting' as string },
  dialCalls: [] as Array<{ toNumber: string }>,
  search: '',
  searchKey: null as string | null,
  searchParams: new URLSearchParams(),
}));

// `dial` mirrors the real one: it gates on the LAGGING ref and fails silently.
const dial = (params: { toNumber: string }) => {
  if (h.statusRef.current !== 'ready') return; // silent no-op, as in production
  h.dialCalls.push(params);
};

vi.mock('@/context/TelephonyProvider', () => ({
  TelephonyProvider: ({ children }: { children: React.ReactNode }) => children,
  useTelephonyPhone: () => ({
    status: h.status,
    currentCall: h.currentCall,
    dial,
  }),
}));

// Identity must be STABLE across renders. TelephonyEmbed's session-bootstrap
// effect depends on [searchParams]; handing it a fresh URLSearchParams every
// render makes that effect setState on every pass — an infinite render loop
// that kills the worker rather than failing an assertion.
vi.mock('react-router-dom', () => ({
  useSearchParams: () => {
    if (h.searchKey !== h.search) {
      h.searchKey = h.search;
      h.searchParams = new URLSearchParams(h.search);
    }
    return [h.searchParams];
  },
}));

vi.mock('@/components/telephony/Softphone', () => ({ Softphone: () => null }));
vi.mock('@/lib/client', () => ({ tokenManager: { setAccessToken: vi.fn() } }));
vi.mock('@/services/authService', () => ({ authService: { setUser: vi.fn() } }));

import TelephonyEmbed from '@/pages/TelephonyEmbed';

/** A valid `u` param: base64 of a user object carrying a tenant. */
const userB64 = btoa(JSON.stringify({ id: 'u1', tenant: { id: 't1' } }));

/**
 * Reproduce the production ordering, and it is the ORDER that matters.
 *
 * The component must RENDER (and run its effects) while `status` already reads
 * 'ready' but `statusRef` is still stale — that is the exact window in which
 * the real `dial()` no-ops. Only afterwards does the parent's sync effect land.
 *
 * Getting this wrong is not a small thing: an earlier version of this helper
 * updated the ref BEFORE re-rendering, so the buggy implementation passed all
 * five tests. A regression test that cannot fail on the bug it was written for
 * is worse than none, because it certifies the defect.
 */
const becomeReadyWithLaggingRef = async (rerender: (ui: React.ReactElement) => void) => {
  await act(async () => {
    h.status = 'ready';
    rerender(<TelephonyEmbed />); // effects run HERE, ref still stale
    await Promise.resolve();
  });
  await act(async () => {
    h.statusRef.current = 'ready'; // the parent effect finally catches up
    await new Promise((r) => setTimeout(r, 20));
  });
};

beforeEach(() => {
  h.status = 'connecting';
  h.statusRef = { current: 'connecting' };
  h.currentCall = null;
  h.dialCalls = [];
  h.search = `token=abc&u=${userB64}&number=919142982138`;
  h.searchKey = null;
});

describe('embed auto-dial', () => {
  it('dials the forwarded number once the softphone is ready', async () => {
    const { rerender } = render(<TelephonyEmbed />);
    await becomeReadyWithLaggingRef(rerender);

    // THE regression assertion. The previous implementation latched before
    // dial() had taken, so this stayed empty forever.
    await waitFor(() => expect(h.dialCalls).toHaveLength(1));
    expect(h.dialCalls[0].toNumber).toBe('919142982138');
  });

  it('does not dial before the softphone is registered', async () => {
    render(<TelephonyEmbed />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    // Still 'connecting' — firing here would hit a dead socket.
    expect(h.dialCalls).toHaveLength(0);
  });

  it('does not dial when no number was forwarded', async () => {
    h.search = `token=abc&u=${userB64}`;
    h.searchKey = null;
    const { rerender } = render(<TelephonyEmbed />);
    await becomeReadyWithLaggingRef(rerender);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    // An embed opened without a number must land on the dialler, untouched.
    expect(h.dialCalls).toHaveLength(0);
  });

  it('never places a second call once one is in progress', async () => {
    // The safety property. A remount or re-render mid-call must not redial a
    // real customer.
    const { rerender } = render(<TelephonyEmbed />);
    await becomeReadyWithLaggingRef(rerender);
    await waitFor(() => expect(h.dialCalls).toHaveLength(1));

    await act(async () => {
      h.currentCall = { number: '919142982138', direction: 'outbound' };
      h.status = 'dialling';
      h.statusRef.current = 'dialling';
      await new Promise((r) => setTimeout(r, 5));
    });
    rerender(<TelephonyEmbed />);

    // Back to ready, as after a hang-up: still must not redial.
    await act(async () => {
      h.currentCall = null;
      h.status = 'ready';
      h.statusRef.current = 'ready';
      await new Promise((r) => setTimeout(r, 5));
    });
    rerender(<TelephonyEmbed />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });

    expect(h.dialCalls).toHaveLength(1);
  });

  it('strips formatting from the forwarded number', async () => {
    h.search = `token=abc&u=${userB64}&number=${encodeURIComponent('+91 91429-82138')}`;
    h.searchKey = null;
    const { rerender } = render(<TelephonyEmbed />);
    await becomeReadyWithLaggingRef(rerender);
    await waitFor(() => expect(h.dialCalls).toHaveLength(1));
    expect(h.dialCalls[0].toNumber).toBe('919142982138');
  });
});
