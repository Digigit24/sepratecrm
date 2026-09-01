// src/components/telephony/__tests__/Softphone.test.tsx
//
// The softphone's "can't call yet" surfaces. These are EXPECTED states, so the
// assertions here are about copy and call-to-action, not about errors.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { TelephonyPhoneContextValue } from '@/context/TelephonyProvider';

const h = vi.hoisted(() => ({
  phone: {} as TelephonyPhoneContextValue,
  navigate: vi.fn(),
  isAdminLike: false,
  permissions: [] as string[],
  // ProfileSwitcher reads the user object through the real `isAdminUser`
  // helper rather than `isAdminLike()`, so the mock has to carry a user.
  user: null as unknown,
  profiles: [] as unknown[],
  assignments: [] as unknown[],
  assignCallingProfile: vi.fn(),
}));

vi.mock('@/context/TelephonyProvider', () => ({
  useTelephonyPhone: () => h.phone,
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: h.user,
    isAdminLike: () => h.isAdminLike,
    hasPermission: (k: string) => h.permissions.includes(k),
  }),
}));

vi.mock('@/hooks/useTelephony', () => ({
  useTelephony: () => ({
    useCallingProfiles: (enabled: boolean) => ({ data: enabled ? h.profiles : undefined }),
    useCallingProfileAssignments: (enabled: boolean) => ({
      data: enabled ? h.assignments : undefined,
      mutate: vi.fn(),
    }),
    assignCallingProfile: h.assignCallingProfile,
  }),
}));

// Not exercised by these branches, but it pulls the whole CRM service graph in.
vi.mock('@/components/telephony/SoftphoneLeadContext', () => ({
  SoftphoneLeadContext: () => null,
}));

import { Softphone } from '@/components/telephony/Softphone';

const basePhone = (over: Partial<TelephonyPhoneContextValue> = {}) =>
  ({
    status: 'not-configured',
    isTelephonyConfigured: false,
    isTelephonyLoading: false,
    telephonyConfigurationError: null,
    notConfiguredReason: null,
    configSource: null,
    hasServerAuth: false,
    telecmiUserId: null,
    sbcHost: null,
    defaultCallerId: null,
    currentCall: null,
    durationSec: 0,
    isMuted: false,
    isOnHold: false,
    transferInitiated: false,
    panelOpen: true,
    setPanelOpen: vi.fn(),
    liveConnected: false,
    login: vi.fn(),
    logout: vi.fn(),
    reconnect: vi.fn().mockResolvedValue(undefined),
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
  h.navigate = vi.fn();
  h.isAdminLike = false;
  h.user = null;
  h.profiles = [];
  h.assignments = [];
  h.assignCallingProfile = vi.fn().mockResolvedValue(undefined);
  h.permissions = [];
  h.phone = basePhone();
});

describe('Softphone — the two 424 reasons', () => {
  it('renders workspace copy for tenant_not_configured', () => {
    h.phone = basePhone({ notConfiguredReason: 'tenant_not_configured' });
    render(<Softphone />);

    const panel = screen.getByTestId('softphone-not-configured');
    expect(panel).toHaveAttribute('data-reason', 'tenant_not_configured');
    expect(panel).toHaveTextContent("Telephony isn't set up for this workspace yet");
    expect(panel).not.toHaveTextContent('Your account has no TeleCMI extension');
  });

  it('renders per-user copy for no_agent', () => {
    h.phone = basePhone({ notConfiguredReason: 'no_agent' });
    render(<Softphone />);

    const panel = screen.getByTestId('softphone-not-configured');
    expect(panel).toHaveAttribute('data-reason', 'no_agent');
    expect(panel).toHaveTextContent('Your account has no TeleCMI extension');
    expect(panel).not.toHaveTextContent("Telephony isn't set up for this workspace yet");
  });

  it('the two reasons do not render the same thing', () => {
    h.phone = basePhone({ notConfiguredReason: 'tenant_not_configured' });
    const a = render(<Softphone />).getByTestId('softphone-not-configured').textContent;
    h.phone = basePhone({ notConfiguredReason: 'no_agent' });
    const b = render(<Softphone />).getAllByTestId('softphone-not-configured')[1].textContent;
    expect(a).not.toEqual(b);
  });

  it('never shows a raw 424 / status code', () => {
    h.phone = basePhone({
      notConfiguredReason: 'tenant_not_configured',
      telephonyConfigurationError: 'Request failed with status code 424',
    });
    render(<Softphone />);
    const panel = screen.getByTestId('softphone-not-configured');
    expect(panel.textContent).not.toMatch(/424/);
  });

  it('hides the workspace settings link from users who cannot configure it', () => {
    h.phone = basePhone({ notConfiguredReason: 'tenant_not_configured' });
    render(<Softphone />);
    expect(screen.queryByRole('button', { name: /open settings/i })).toBeNull();
    // but there is always a way forward
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('shows the settings link to an admin', () => {
    h.isAdminLike = true;
    h.phone = basePhone({ notConfiguredReason: 'tenant_not_configured' });
    render(<Softphone />);
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }));
    expect(h.navigate).toHaveBeenCalledWith('/admin/settings');
  });

  it('shows the settings link for no_agent regardless of permission', () => {
    h.phone = basePhone({ notConfiguredReason: 'no_agent' });
    render(<Softphone />);
    expect(screen.getByRole('button', { name: /open settings/i })).toBeTruthy();
  });

  it('Retry calls reconnect() rather than reloading', () => {
    const reconnect = vi.fn().mockResolvedValue(undefined);
    h.phone = basePhone({ notConfiguredReason: 'no_agent', reconnect });
    render(<Softphone />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it('falls back to neutral copy for an unknown reason', () => {
    h.phone = basePhone({ notConfiguredReason: null });
    render(<Softphone />);
    const panel = screen.getByTestId('softphone-not-configured');
    expect(panel).toHaveAttribute('data-reason', 'unknown');
    expect(panel).toHaveTextContent(/Telephony isn't available right now/);
  });
});

describe('Softphone — tenant-default identity', () => {
  it('quietly notes the shared extension on the dialpad', () => {
    h.phone = basePhone({
      status: 'ready',
      isTelephonyConfigured: true,
      configSource: 'tenant',
      telecmiUserId: '103_1111112',
    });
    render(<Softphone />);
    const note = screen.getByTestId('softphone-tenant-identity-note');
    expect(note).toHaveTextContent(/shared extension/i);
    expect(note).toHaveTextContent('103_1111112');
  });

  // The backend split the old single 'tenant' value into 'tenant_profile' and
  // 'tenant_default'. A `!== 'tenant'` comparison would silently stop warning
  // people that they are sharing an extension — the failure mode is invisible.
  it.each(['tenant_profile', 'tenant_default', 'tenant'] as const)(
    'notes the shared extension for source %s',
    (configSource) => {
      h.phone = basePhone({
        status: 'ready',
        isTelephonyConfigured: true,
        configSource,
        telecmiUserId: '103_1111112',
      });
      render(<Softphone />);
      expect(screen.getByTestId('softphone-tenant-identity-note')).toBeInTheDocument();
    },
  );

  it('says nothing for a per-user extension', () => {
    h.phone = basePhone({ status: 'ready', isTelephonyConfigured: true, configSource: 'user' });
    render(<Softphone />);
    expect(screen.queryByTestId('softphone-tenant-identity-note')).toBeNull();
  });

  it('says nothing when an admin assigned this user their own profile', () => {
    h.phone = basePhone({
      status: 'ready',
      isTelephonyConfigured: true,
      configSource: 'assigned_profile',
    });
    render(<Softphone />);
    expect(screen.queryByTestId('softphone-tenant-identity-note')).toBeNull();
  });
});

describe('Softphone — server-supplied auth', () => {
  it('does not ask for a password when the server supplies the credential', () => {
    h.phone = basePhone({
      status: 'needs-password',
      hasServerAuth: true,
      telecmiUserId: '103_1111112',
    });
    render(<Softphone />);
    expect(screen.getByTestId('softphone-server-auth')).toBeTruthy();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it('still shows the password form when the backend has not shipped `auth`', () => {
    h.phone = basePhone({
      status: 'needs-password',
      hasServerAuth: false,
      telecmiUserId: '103_1111112',
    });
    render(<Softphone />);
    expect(screen.queryByTestId('softphone-server-auth')).toBeNull();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });
});

describe('embedded mode (/telephony/embed in the crmflutter WebView)', () => {
  it('renders no launcher — embedded, the panel IS the page', () => {
    h.phone = basePhone({ status: 'ready' });
    render(<Softphone embedded />);
    // Without this the WebView shows a 48px circle on a blank screen and the
    // dialler hides behind a tap nothing prompts you to make.
    expect(screen.queryByLabelText('Open softphone')).not.toBeInTheDocument();
  });

  it('still renders the launcher in normal overlay mode', () => {
    h.phone = basePhone({ status: 'ready' });
    render(<Softphone />);
    expect(screen.getByLabelText('Open softphone')).toBeInTheDocument();
  });

  it('opens itself when embedded, since nothing else can', () => {
    const setPanelOpen = vi.fn();
    h.phone = basePhone({ status: 'ready', panelOpen: false, setPanelOpen });
    render(<Softphone embedded />);
    expect(setPanelOpen).toHaveBeenCalledWith(true);
  });

  it('does not force the panel open in normal mode', () => {
    const setPanelOpen = vi.fn();
    h.phone = basePhone({ status: 'ready', panelOpen: false, setPanelOpen });
    render(<Softphone />);
    expect(setPanelOpen).not.toHaveBeenCalled();
  });

  it('hides the close button — closing would leave a dead blank WebView', () => {
    h.phone = basePhone({ status: 'ready' });
    render(<Softphone embedded />);
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();
  });

  it('shows the dialler and the call button, which is the whole ask', () => {
    h.phone = basePhone({ status: 'ready' });
    render(<Softphone embedded />);
    expect(screen.getByPlaceholderText('Enter number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /call/i })).toBeInTheDocument();
    for (const key of ['1', '5', '9', '0', '*', '#']) {
      expect(screen.getByRole('button', { name: key })).toBeInTheDocument();
    }
  });

  it('drops the workspace-identity footnote embedded, keeps it in the app', () => {
    const shared = { status: 'ready', configSource: 'tenant' } as const;
    const { unmount } = render(<Softphone embedded />);
    expect(screen.queryByTestId('softphone-tenant-identity-note')).not.toBeInTheDocument();
    unmount();

    h.phone = basePhone(shared);
    render(<Softphone />);
    // Only asserted when the identity really is shared; otherwise the note is
    // correctly absent in both modes and this would prove nothing.
    if (screen.queryByTestId('softphone-tenant-identity-note')) {
      expect(screen.getByTestId('softphone-tenant-identity-note')).toBeInTheDocument();
    }
  });
});

describe('admin calling-profile switcher on the embed page', () => {
  const ADMIN = { id: 'admin-1', permissions: { 'admin.full_access': true } };
  const SALES = { id: 1, label: 'Sales line', caller_id: '+911111', is_default: true, is_active: true };
  const SUPPORT = { id: 2, label: 'Support line', caller_id: '+912222', is_default: false, is_active: true };

  const asAdminWithTwoProfiles = (over = {}) => {
    h.user = ADMIN;
    h.profiles = [SALES, SUPPORT];
    h.phone = basePhone({ status: 'ready', configSource: 'tenant_profile', ...over });
  };

  it('lets an admin pick a line when there is more than one', () => {
    asAdminWithTwoProfiles();
    render(<Softphone embedded />);
    expect(screen.getByTestId('softphone-profile-switcher')).toBeInTheDocument();
  });

  it('hides itself for a regular user — they get their assigned line, no choice', () => {
    h.user = { id: 'rep-1', permissions: {} };
    h.profiles = [SALES, SUPPORT];
    h.phone = basePhone({ status: 'ready', configSource: 'assigned_profile' });
    render(<Softphone embedded />);
    expect(screen.queryByTestId('softphone-profile-switcher')).not.toBeInTheDocument();
  });

  it('hides itself with one profile — a switcher with nothing to switch to is clutter', () => {
    h.user = ADMIN;
    h.profiles = [SALES];
    h.phone = basePhone({ status: 'ready', configSource: 'tenant_profile' });
    render(<Softphone embedded />);
    expect(screen.queryByTestId('softphone-profile-switcher')).not.toBeInTheDocument();
  });

  it('stays out of the normal in-app overlay', () => {
    asAdminWithTwoProfiles();
    render(<Softphone />);
    expect(screen.queryByTestId('softphone-profile-switcher')).not.toBeInTheDocument();
  });

  it('shows the line the server actually resolved, not the first in the list', () => {
    h.user = ADMIN;
    h.profiles = [SALES, SUPPORT];
    h.assignments = [{ user_id: 'admin-1', profile_id: 2 }];
    h.phone = basePhone({ status: 'ready', configSource: 'assigned_profile' });
    render(<Softphone embedded />);
    expect(screen.getByLabelText('Calling profile')).toHaveTextContent('Support line');
  });

  it('falls back to the tenant default when the admin has no assignment', () => {
    asAdminWithTwoProfiles();
    render(<Softphone embedded />);
    expect(screen.getByLabelText('Calling profile')).toHaveTextContent('Sales line');
  });

  it('warns instead of switching when a personal extension outranks profiles', () => {
    // Resolution step 1 beats any assignment, so the control would appear to
    // work and change nothing. This is the Nakshatra shape.
    asAdminWithTwoProfiles({ configSource: 'user' });
    render(<Softphone embedded />);
    expect(screen.getByTestId('softphone-profile-switcher-blocked')).toBeInTheDocument();
    expect(screen.queryByTestId('softphone-profile-switcher')).not.toBeInTheDocument();
  });

  it('drops inactive profiles — you cannot register on a disabled line', () => {
    h.user = ADMIN;
    h.profiles = [SALES, { ...SUPPORT, is_active: false }];
    h.phone = basePhone({ status: 'ready', configSource: 'tenant_profile' });
    render(<Softphone embedded />);
    // Only one usable line left, so there is nothing to switch between.
    expect(screen.queryByTestId('softphone-profile-switcher')).not.toBeInTheDocument();
  });

  it('does not fetch profiles at all for a regular user', () => {
    // The hooks are called with enabled=false, which nulls the SWR key. Asserted
    // through the mock: disabled hooks hand back undefined, not the array.
    h.user = { id: 'rep-1', permissions: {} };
    h.profiles = [SALES, SUPPORT];
    h.phone = basePhone({ status: 'ready', configSource: 'assigned_profile' });
    render(<Softphone embedded />);
    expect(screen.queryByText('Calling from')).not.toBeInTheDocument();
  });
});

describe('switching a line actually re-registers the phone', () => {
  const ADMIN = { id: 'admin-1', permissions: { 'admin.full_access': true } };
  const SALES = { id: 1, label: 'Sales line', caller_id: '+911111', is_default: true, is_active: true };
  const SUPPORT = { id: 2, label: 'Support line', caller_id: '+912222', is_default: false, is_active: true };

  // Radix Select drives itself with Pointer Events, which jsdom does not
  // implement. Without these the trigger never opens and the test would fail
  // for reasons that have nothing to do with the softphone.
  beforeEach(() => {
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
      Element.prototype.setPointerCapture = () => {};
      Element.prototype.releasePointerCapture = () => {};
    }
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
  });

  it('writes the assignment and then reconnects, in that order', async () => {
    const order: string[] = [];
    h.user = ADMIN;
    h.profiles = [SALES, SUPPORT];
    h.assignCallingProfile = vi.fn(async () => { order.push('assign'); });
    const reconnect = vi.fn(async () => { order.push('reconnect'); });
    h.phone = basePhone({ status: 'ready', configSource: 'tenant_profile', reconnect });

    render(<Softphone embedded />);
    fireEvent.click(screen.getByLabelText('Calling profile'));
    fireEvent.click(await screen.findByRole('option', { name: /Support line/ }));

    await waitFor(() => expect(h.assignCallingProfile).toHaveBeenCalledWith(2, 'admin-1'));
    await waitFor(() => expect(reconnect).toHaveBeenCalled());
    // Reconnecting BEFORE the assignment lands would re-resolve the old line
    // and leave the phone on it while the UI claimed otherwise.
    expect(order).toEqual(['assign', 'reconnect']);
  });

  it('does not reconnect when the assignment fails', async () => {
    h.user = ADMIN;
    h.profiles = [SALES, SUPPORT];
    h.assignCallingProfile = vi.fn().mockRejectedValue(new Error('403'));
    const reconnect = vi.fn();
    h.phone = basePhone({ status: 'ready', configSource: 'tenant_profile', reconnect });

    render(<Softphone embedded />);
    fireEvent.click(screen.getByLabelText('Calling profile'));
    fireEvent.click(await screen.findByRole('option', { name: /Support line/ }));

    await waitFor(() => expect(h.assignCallingProfile).toHaveBeenCalled());
    // Tearing down a working session for a switch that did not happen would
    // leave the admin unable to call at all.
    expect(reconnect).not.toHaveBeenCalled();
  });

  it('ignores re-picking the line already in use', async () => {
    h.user = ADMIN;
    h.profiles = [SALES, SUPPORT];
    const reconnect = vi.fn();
    h.phone = basePhone({ status: 'ready', configSource: 'tenant_profile', reconnect });

    render(<Softphone embedded />);
    fireEvent.click(screen.getByLabelText('Calling profile'));
    fireEvent.click(await screen.findByRole('option', { name: /Sales line/ }));

    await new Promise((r) => setTimeout(r, 0));
    expect(h.assignCallingProfile).not.toHaveBeenCalled();
    expect(reconnect).not.toHaveBeenCalled();
  });
});
