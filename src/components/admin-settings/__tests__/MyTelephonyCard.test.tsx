// src/components/admin-settings/__tests__/MyTelephonyCard.test.tsx
//
// The settings card is where "save then the softphone must reconnect, with no
// logout/login round trip" is wired. That wiring is what these tests pin down.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { TelephonyPhoneContextValue } from '@/context/TelephonyProvider';

const h = vi.hoisted(() => ({
  phone: {} as TelephonyPhoneContextValue,
  agent: undefined as Record<string, unknown> | undefined,
  mutate: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  refreshToken: vi.fn(),
  reconnect: vi.fn(),
  calls: [] as string[],
  moduleEnabled: true,
}));

vi.mock('@/context/TelephonyProvider', () => ({
  useTelephonyPhone: () => h.phone,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u-1' },
    hasModuleAccess: () => h.moduleEnabled,
  }),
}));

vi.mock('@/hooks/useTelephony', () => ({
  useTelephony: () => ({
    useMyAgent: () => ({ agent: h.agent, isLoading: false, mutate: h.mutate }),
    createAgent: h.createAgent,
    updateAgent: h.updateAgent,
    refreshToken: h.refreshToken,
  }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { MyTelephonyCard } from '@/components/admin-settings/MyTelephonyCard';

const basePhone = (over: Partial<TelephonyPhoneContextValue> = {}) =>
  ({
    status: 'ready',
    isTelephonyConfigured: true,
    isTelephonyLoading: false,
    telephonyConfigurationError: null,
    notConfiguredReason: null,
    configSource: null,
    hasServerAuth: true,
    telecmiUserId: '103_1111112',
    sbcHost: 'sbcind.telecmi.com',
    defaultCallerId: null,
    currentCall: null,
    durationSec: 0,
    isMuted: false,
    isOnHold: false,
    transferInitiated: false,
    panelOpen: false,
    setPanelOpen: vi.fn(),
    liveConnected: false,
    login: vi.fn(),
    logout: vi.fn(),
    reconnect: h.reconnect,
    dial: vi.fn(),
    answer: vi.fn(),
    reject: vi.fn(),
    hangUp: vi.fn(),
    hold: vi.fn(),
    unhold: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    sendDtmf: vi.fn(),
    transfer: vi.fn(),
    merge: vi.fn(),
    ...over,
  }) as TelephonyPhoneContextValue;

beforeEach(() => {
  h.calls = [];
  h.moduleEnabled = true;
  h.agent = undefined;
  h.mutate = vi.fn(async () => {
    h.calls.push('mutate');
  });
  h.createAgent = vi.fn(async () => {
    h.calls.push('createAgent');
    return {};
  });
  h.updateAgent = vi.fn(async () => {
    h.calls.push('updateAgent');
    return {};
  });
  h.refreshToken = vi.fn(async () => {
    h.calls.push('refreshToken');
  });
  h.reconnect = vi.fn(async () => {
    h.calls.push('reconnect');
  });
  h.phone = basePhone();
});

describe('MyTelephonyCard — reconnect on save', () => {
  it('reconnects the softphone after registering a new agent', async () => {
    render(<MyTelephonyCard />);

    fireEvent.change(screen.getByLabelText('TeleCMI User ID'), {
      target: { value: '104_2222223' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /register agent/i }));

    await waitFor(() => expect(h.reconnect).toHaveBeenCalledTimes(1));
    // …and only after the save + cache refresh landed
    expect(h.calls).toEqual(['createAgent', 'mutate', 'reconnect']);
  });

  it('reconnects the softphone after updating an existing agent', async () => {
    h.agent = { id: 7, telecmi_user_id: '103_1111112', token_is_fresh: true };
    render(<MyTelephonyCard />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText('TeleCMI User ID'), {
      target: { value: '104_2222223' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(h.reconnect).toHaveBeenCalledTimes(1));
    expect(h.updateAgent).toHaveBeenCalledWith(7, { telecmi_user_id: '104_2222223' });
    expect(h.calls).toEqual(['updateAgent', 'mutate', 'reconnect']);
  });

  it('reconnects after a token refresh so the new token is actually used', async () => {
    h.agent = { id: 7, telecmi_user_id: '103_1111112', token_is_fresh: false };
    render(<MyTelephonyCard />);

    fireEvent.click(screen.getByRole('button', { name: /refresh token/i }));

    await waitFor(() => expect(h.reconnect).toHaveBeenCalledTimes(1));
    expect(h.calls).toEqual(['refreshToken', 'mutate', 'reconnect']);
  });

  it('does not reconnect when the save itself failed', async () => {
    h.agent = { id: 7, telecmi_user_id: '103_1111112', token_is_fresh: true };
    h.updateAgent = vi.fn(async () => {
      throw new Error('nope');
    });
    render(<MyTelephonyCard />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(h.updateAgent).toHaveBeenCalled());
    expect(h.reconnect).not.toHaveBeenCalled();
  });
});

describe('MyTelephonyCard — readiness row', () => {
  it('explains tenant_not_configured as a workspace-level job', () => {
    h.phone = basePhone({ isTelephonyConfigured: false, notConfiguredReason: 'tenant_not_configured' });
    render(<MyTelephonyCard />);
    const row = screen.getByTestId('telephony-readiness-not-configured');
    expect(row).toHaveAttribute('data-reason', 'tenant_not_configured');
    expect(row).toHaveTextContent("Telephony isn't set up for this workspace yet");
  });

  it('explains no_agent as this user missing an extension', () => {
    h.phone = basePhone({ isTelephonyConfigured: false, notConfiguredReason: 'no_agent' });
    render(<MyTelephonyCard />);
    const row = screen.getByTestId('telephony-readiness-not-configured');
    expect(row).toHaveAttribute('data-reason', 'no_agent');
    expect(row).toHaveTextContent('Your account has no TeleCMI extension');
  });

  it('notes when the workspace default extension is in use', () => {
    h.phone = basePhone({ configSource: 'tenant' });
    render(<MyTelephonyCard />);
    const note = screen.getByTestId('telephony-tenant-identity-note');
    expect(note).toHaveTextContent(/shared extension/i);
    expect(note).toHaveTextContent('103_1111112');
  });

  it('says nothing about identity for a per-user extension', () => {
    h.phone = basePhone({ configSource: 'user' });
    render(<MyTelephonyCard />);
    expect(screen.queryByTestId('telephony-tenant-identity-note')).toBeNull();
  });
});

describe('MyTelephonyCard — module gate', () => {
  it('renders nothing (and touches no telephony hook) without the module', () => {
    // TelephonyProvider is not mounted in this case, so a telephony hook here
    // would throw and blank the whole settings page.
    h.moduleEnabled = false;
    h.phone = new Proxy({} as TelephonyPhoneContextValue, {
      get() {
        throw new Error('useTelephonyPhone() must not be called without the module');
      },
    });
    const { container } = render(<MyTelephonyCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
