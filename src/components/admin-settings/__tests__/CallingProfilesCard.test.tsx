// src/components/admin-settings/__tests__/CallingProfilesCard.test.tsx
//
// The calling-profiles admin surface has three properties that are easy to
// break silently and expensive to break in production:
//   1. the extension password is write-only — nothing may ever render it back;
//   2. it is admin-only, and its gate must sit IN FRONT of every telephony hook
//      (TelephonyProvider is not mounted for tenants without the module, so a
//      hook that runs before the guard blanks the whole settings page);
//   3. the backend is being built in parallel, so a 404 has to look unfinished
//      rather than broken.
// Plus the reason the feature exists at all: saving or assigning a profile must
// reconnect the live softphone without a page reload or a re-login.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { TelephonyPhoneContextValue } from '@/context/TelephonyProvider';
import type { CallingProfile } from '@/types/telephony.types';

const h = vi.hoisted(() => ({
  phone: {} as TelephonyPhoneContextValue,
  profiles: [] as CallingProfile[],
  profilesError: undefined as unknown,
  profilesLoading: false,
  assignments: [] as { user_id: string; profile_id: number }[],
  assignmentsError: undefined as unknown,
  users: [] as { id: string; name: string; email: string; isActive: boolean }[],
  isAdmin: true,
  permissions: {} as Record<string, unknown>,
  moduleEnabled: true,
  calls: [] as string[],
  createCallingProfile: vi.fn(),
  updateCallingProfile: vi.fn(),
  deleteCallingProfile: vi.fn(),
  verifyCallingProfile: vi.fn(),
  assignCallingProfile: vi.fn(),
  unassignCallingProfile: vi.fn(),
  mutateProfiles: vi.fn(),
  mutateAssignments: vi.fn(),
  reconnect: vi.fn(),
}));

vi.mock('@/context/TelephonyProvider', () => ({
  useTelephonyPhone: () => h.phone,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', is_super_admin: h.isAdmin, permissions: h.permissions },
    hasModuleAccess: () => h.moduleEnabled,
  }),
}));

vi.mock('@/hooks/useTelephony', () => ({
  useTelephony: () => ({
    useCallingProfiles: () => ({
      data: h.profiles,
      error: h.profilesError,
      isLoading: h.profilesLoading,
      mutate: h.mutateProfiles,
    }),
    useCallingProfileAssignments: () => ({
      data: h.assignments,
      error: h.assignmentsError,
      mutate: h.mutateAssignments,
    }),
    createCallingProfile: h.createCallingProfile,
    updateCallingProfile: h.updateCallingProfile,
    deleteCallingProfile: h.deleteCallingProfile,
    verifyCallingProfile: h.verifyCallingProfile,
    assignCallingProfile: h.assignCallingProfile,
    unassignCallingProfile: h.unassignCallingProfile,
  }),
}));

vi.mock('@/hooks/useUserDirectory', () => ({
  useUserDirectory: () => ({
    users: h.users,
    byId: new Map(h.users.map((u) => [u.id, u])),
    isLoading: false,
    isForbidden: false,
  }),
}));

// The real module pulls in the axios client; only the status predicate matters here.
vi.mock('@/services/telephonyService', () => ({
  isTelephonyEndpointUnavailable: (e: unknown) => {
    const status = (e as { status?: number } | undefined)?.status;
    return status === 404 || status === 501 || status === 502 || status === 503;
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// Radix's Select needs pointer-event APIs jsdom does not implement. Swap in a
// native <select> so the ASSIGNMENT WIRING (the thing under test) is observable.
vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  type AnyProps = Record<string, unknown>;
  const SelectValue = () => null;
  const SelectTrigger: React.FC<AnyProps> = () => null;
  const SelectContent: React.FC<AnyProps> = () => null;
  const SelectItem: React.FC<AnyProps> = ({ value, children }) =>
    React.createElement('option', { value: String(value) }, children as React.ReactNode);
  // The trigger (which owns aria-label) and the item list are SIBLINGS in the
  // radix API, so flatten them into one native <select> here.
  const Select: React.FC<AnyProps> = ({ value, onValueChange, disabled, children }) => {
    const nodes = React.Children.toArray(
      children as React.ReactNode,
    ) as React.ReactElement<AnyProps>[];
    const trigger = nodes.find((n) => n.type === SelectTrigger);
    const content = nodes.find((n) => n.type === SelectContent);
    return React.createElement(
      'select',
      {
        'aria-label': trigger?.props?.['aria-label'],
        value: String(value),
        disabled: !!disabled,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
          (onValueChange as (v: string) => void)(e.target.value),
      },
      content?.props?.children as React.ReactNode,
    );
  };
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

import { CallingProfilesSection } from '@/components/admin-settings/CallingProfilesCard';

const SECRET = 'sup3r-secret-extension-pw';

const profile = (over: Partial<CallingProfile> = {}): CallingProfile => ({
  id: 1,
  label: 'Sales line',
  telecmi_user_id: '103_1111112',
  caller_id: '+918000000000',
  is_default: true,
  is_active: true,
  has_password: true,
  verified_at: '2026-08-01T00:00:00Z',
  verify_error: null,
  ...over,
});

const basePhone = (over: Partial<TelephonyPhoneContextValue> = {}) =>
  ({
    status: 'ready',
    isTelephonyConfigured: true,
    isTelephonyLoading: false,
    telephonyConfigurationError: null,
    notConfiguredReason: null,
    configSource: 'assigned_profile',
    hasServerAuth: true,
    telecmiUserId: '103_1111112',
    sbcHost: 'sbcind.telecmi.com',
    defaultCallerId: '+918000000000',
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
  h.isAdmin = true;
  h.permissions = {};
  h.moduleEnabled = true;
  h.profiles = [profile()];
  h.profilesError = undefined;
  h.profilesLoading = false;
  h.assignments = [];
  h.assignmentsError = undefined;
  h.users = [
    { id: 'u-1', name: 'Asha Rao', email: 'asha@example.com', isActive: true },
    { id: 'u-2', name: 'Bilal Khan', email: 'bilal@example.com', isActive: true },
  ];
  h.createCallingProfile = vi.fn(async () => {
    h.calls.push('create');
    return profile({ id: 9 });
  });
  h.updateCallingProfile = vi.fn(async () => {
    h.calls.push('update');
    return profile();
  });
  h.deleteCallingProfile = vi.fn(async () => {
    h.calls.push('delete');
  });
  h.verifyCallingProfile = vi.fn(async () => {
    h.calls.push('verify');
    return { ok: true, error: null };
  });
  h.assignCallingProfile = vi.fn(async () => {
    h.calls.push('assign');
  });
  h.unassignCallingProfile = vi.fn(async () => {
    h.calls.push('unassign');
  });
  h.mutateProfiles = vi.fn(async () => {
    h.calls.push('mutateProfiles');
  });
  h.mutateAssignments = vi.fn(async () => {
    h.calls.push('mutateAssignments');
  });
  h.reconnect = vi.fn(async () => {
    h.calls.push('reconnect');
  });
  h.phone = basePhone();
});

// ==================== gating ====================

describe('CallingProfilesSection — gating', () => {
  it('renders nothing (and touches no telephony hook) without the module', () => {
    h.moduleEnabled = false;
    h.phone = new Proxy({} as TelephonyPhoneContextValue, {
      get() {
        throw new Error('useTelephonyPhone() must not be called without the module');
      },
    });
    const { container } = render(<CallingProfilesSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a non-admin without telephony.settings.edit', () => {
    h.isAdmin = false;
    h.permissions = { leads: { view: true } };
    const { container } = render(<CallingProfilesSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders for a non-admin who has been granted telephony.settings.edit', () => {
    h.isAdmin = false;
    h.permissions = { 'telephony.settings.edit': 'all' };
    render(<CallingProfilesSection />);
    expect(screen.getByTestId('calling-profiles-card')).toBeInTheDocument();
  });

  it('renders for an admin', () => {
    render(<CallingProfilesSection />);
    expect(screen.getByTestId('calling-profiles-card')).toBeInTheDocument();
  });
});

// ==================== the password is write-only ====================

describe('CallingProfilesSection — the password is never rendered', () => {
  it('shows only that a password is stored, never a value, in the table', () => {
    render(<CallingProfilesSection />);
    expect(document.body.textContent).not.toContain(SECRET);
    // No masked stand-in either — a stored password is expressed as "Verified".
    expect(screen.getByTestId('calling-profile-status-1')).toHaveAttribute(
      'data-state',
      'verified',
    );
  });

  it('opens the edit form with an EMPTY password field and a replace-it hint', () => {
    render(<CallingProfilesSection />);
    fireEvent.click(screen.getByRole('button', { name: /edit sales line/i }));

    const password = screen.getByLabelText('Extension password') as HTMLInputElement;
    expect(password.value).toBe('');
    expect(password.type).toBe('password');
    expect(password.placeholder).toMatch(/enter a new one to replace it/i);
    // Every other field IS prefilled — so a blank password is a deliberate choice.
    expect((screen.getByLabelText('Label') as HTMLInputElement).value).toBe('Sales line');
    expect(
      (screen.getByLabelText('Extension (TeleCMI username)') as HTMLInputElement).value,
    ).toBe('103_1111112');
  });

  it('says the password is the TeleCMI extension password, not a CRM password', () => {
    render(<CallingProfilesSection />);
    fireEvent.click(screen.getByTestId('calling-profile-add'));
    expect(screen.getByText(/TeleCMI extension password from the TeleCMI dashboard/i))
      .toBeInTheDocument();
    expect(document.body.textContent).toMatch(/not a Celiyo\/CRM password/i);
  });

  it('omits the password entirely from an edit PATCH when left blank', async () => {
    render(<CallingProfilesSection />);
    fireEvent.click(screen.getByRole('button', { name: /edit sales line/i }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Support line' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(h.updateCallingProfile).toHaveBeenCalled());
    const [, payload] = h.updateCallingProfile.mock.calls[0];
    expect(payload).not.toHaveProperty('password');
    expect(payload.label).toBe('Support line');
  });
});

// ==================== create + verify + reconnect ====================

describe('CallingProfilesSection — saving a profile', () => {
  it('sends the typed password on create, then verifies and reconnects', async () => {
    render(<CallingProfilesSection />);
    fireEvent.click(screen.getByTestId('calling-profile-add'));

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Support line' } });
    fireEvent.change(screen.getByLabelText('Extension (TeleCMI username)'), {
      target: { value: '104_2222223' },
    });
    fireEvent.change(screen.getByLabelText('Extension password'), {
      target: { value: SECRET },
    });
    fireEvent.click(screen.getByRole('button', { name: /create profile/i }));

    await waitFor(() => expect(h.reconnect).toHaveBeenCalledTimes(1));
    expect(h.createCallingProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Support line',
        telecmi_user_id: '104_2222223',
        password: SECRET,
      }),
    );
    // Save -> refresh list -> reconnect the live softphone -> verify upstream.
    expect(h.calls).toEqual(['create', 'mutateProfiles', 'reconnect', 'verify']);
    expect(h.verifyCallingProfile).toHaveBeenCalledWith(9);
  });

  it('keeps the saved profile when verification fails, and shows the reason inline', async () => {
    h.verifyCallingProfile = vi.fn(async () => ({ ok: false, error: 'SBC rejected password' }));
    render(<CallingProfilesSection />);
    fireEvent.click(screen.getByRole('button', { name: /edit sales line/i }));
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(h.verifyCallingProfile).toHaveBeenCalled());
    // The save stands — nothing rolled it back.
    expect(h.updateCallingProfile).toHaveBeenCalled();
    expect(h.deleteCallingProfile).not.toHaveBeenCalled();
    const status = await screen.findByTestId('calling-profile-status-1');
    expect(status).toHaveAttribute('data-state', 'failed');
    expect(status).toHaveTextContent('SBC rejected password');
  });

  it('refuses to create a profile with no password', async () => {
    render(<CallingProfilesSection />);
    fireEvent.click(screen.getByTestId('calling-profile-add'));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Support line' } });
    fireEvent.change(screen.getByLabelText('Extension (TeleCMI username)'), {
      target: { value: '104_2222223' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create profile/i }));

    await waitFor(() => expect(h.createCallingProfile).not.toHaveBeenCalled());
  });
});

// ==================== assignment ====================

describe('CallingProfilesSection — user assignment', () => {
  it('assigns a profile to a user and reconnects so the change takes effect', async () => {
    render(<CallingProfilesSection />);
    fireEvent.change(screen.getByLabelText('Calling profile for Asha Rao'), {
      target: { value: '1' },
    });

    await waitFor(() => expect(h.assignCallingProfile).toHaveBeenCalledWith(1, 'u-1'));
    expect(h.calls).toEqual(['assign', 'mutateAssignments', 'reconnect']);
  });

  it('unassigns when the user is put back on the workspace default', async () => {
    h.assignments = [{ user_id: 'u-1', profile_id: 1 }];
    render(<CallingProfilesSection />);
    fireEvent.change(screen.getByLabelText('Calling profile for Asha Rao'), {
      target: { value: '__none__' },
    });

    await waitFor(() => expect(h.unassignCallingProfile).toHaveBeenCalledWith(1, 'u-1'));
    expect(h.assignCallingProfile).not.toHaveBeenCalled();
  });

  it('drops the old profile before adding the new one when switching', async () => {
    h.profiles = [profile(), profile({ id: 2, label: 'Support line', is_default: false })];
    h.assignments = [{ user_id: 'u-1', profile_id: 1 }];
    render(<CallingProfilesSection />);
    fireEvent.change(screen.getByLabelText('Calling profile for Asha Rao'), {
      target: { value: '2' },
    });

    await waitFor(() => expect(h.assignCallingProfile).toHaveBeenCalledWith(2, 'u-1'));
    expect(h.unassignCallingProfile).toHaveBeenCalledWith(1, 'u-1');
    expect(h.calls).toEqual(['unassign', 'assign', 'mutateAssignments', 'reconnect']);
  });

  it('shows the tenant default as the effective identity for unassigned users', () => {
    render(<CallingProfilesSection />);
    const row = screen.getByTestId('calling-profile-user-u-2');
    expect(within(row).getByText('103_1111112')).toBeInTheDocument();
    expect(within(row).getByText('(default)')).toBeInTheDocument();
  });

  it('warns plainly when several people share one profile', () => {
    h.assignments = [
      { user_id: 'u-1', profile_id: 1 },
      { user_id: 'u-2', profile_id: 1 },
    ];
    render(<CallingProfilesSection />);
    const warning = screen.getByTestId('calling-profiles-shared-warning');
    expect(warning).toHaveTextContent(/shared by more than one person/i);
    expect(warning).toHaveTextContent(/same caller ID/i);
  });

  it('warns when nothing is marked as the workspace default', () => {
    h.profiles = [profile({ is_default: false })];
    render(<CallingProfilesSection />);
    expect(screen.getByTestId('calling-profiles-no-default')).toBeInTheDocument();
  });
});

// ==================== graceful degradation ====================

describe('CallingProfilesSection — backend not shipped yet', () => {
  it('renders a calm "not available yet" panel on a 404 instead of crashing', () => {
    h.profilesError = { status: 404 };
    h.profiles = [];
    render(<CallingProfilesSection />);

    expect(screen.getByTestId('calling-profiles-unavailable')).toHaveTextContent(
      /not available on this server yet/i,
    );
    // No table, no assignment card, and nothing that looks like a failure.
    expect(screen.queryByTestId('calling-profiles-card')).toBeNull();
    expect(screen.queryByTestId('calling-profile-assignments-card')).toBeNull();
    // The connection re-test still works — it does not depend on the new API.
    expect(screen.getByTestId('softphone-reconnect')).toBeInTheDocument();
    // The backend answers 404 (not 403) for profiles the caller may not see, so
    // a 404 must never be dressed up as a permissions failure.
    expect(document.body.textContent).not.toMatch(/forbidden|not authoris|not authoriz|permission/i);
  });

  it.each([501, 502, 503])('treats %i the same way', (status) => {
    h.profilesError = { status };
    h.profiles = [];
    render(<CallingProfilesSection />);
    expect(screen.getByTestId('calling-profiles-unavailable')).toBeInTheDocument();
  });

  it('still shows the profiles table when only the assignments endpoint is missing', () => {
    h.assignmentsError = { status: 404 };
    render(<CallingProfilesSection />);
    expect(screen.getByTestId('calling-profiles-card')).toBeInTheDocument();
    expect(screen.getByTestId('calling-profile-assignments-unavailable')).toBeInTheDocument();
  });
});

// ==================== connection re-test ====================

describe('SoftphoneConnectionCard', () => {
  it('re-tests the connection on demand', async () => {
    render(<CallingProfilesSection />);
    fireEvent.click(screen.getByTestId('softphone-reconnect'));
    await waitFor(() => expect(h.reconnect).toHaveBeenCalledTimes(1));
  });

  it('names the live profile, not just the source, so an admin can tell which is live', () => {
    render(<CallingProfilesSection />);
    const source = screen.getByTestId('softphone-connection-source');
    expect(source).toHaveTextContent('Sales line');
    expect(source).toHaveTextContent('Calling profile assigned to you');
    expect(screen.queryByTestId('softphone-connection-shared-note')).toBeNull();
  });

  it('says out loud when the live identity is the shared workspace profile', () => {
    h.phone = basePhone({ configSource: 'tenant_profile' });
    render(<CallingProfilesSection />);
    expect(screen.getByTestId('softphone-connection-shared-note')).toBeInTheDocument();
    expect(screen.getByTestId('softphone-connection-source')).toHaveTextContent(
      'Workspace default calling profile',
    );
  });

  // The backend renamed this path and no longer emits 'tenant', but the two
  // repos deploy independently — an older server must not make the widget lie.
  it("treats the deprecated 'tenant' source exactly like 'tenant_default'", () => {
    h.phone = basePhone({ configSource: 'tenant', telecmiUserId: 'legacy_1' });
    render(<CallingProfilesSection />);
    expect(screen.getByTestId('softphone-connection-shared-note')).toBeInTheDocument();
    expect(screen.getByTestId('softphone-connection-source')).toHaveTextContent(
      'Legacy workspace extension',
    );
  });

  it("falls back to neutral copy for a source value this build doesn't know", () => {
    h.phone = basePhone({
      // A sixth value added by a future backend must not blank the row.
      configSource: 'something_new' as never,
      telecmiUserId: 'x_1',
    });
    render(<CallingProfilesSection />);
    expect(screen.getByTestId('softphone-connection-source')).toHaveTextContent(
      'Workspace telephony identity',
    );
  });

  it('shows an em dash, never "undefined", when no source was returned', () => {
    h.phone = basePhone({ configSource: null, telecmiUserId: null });
    render(<CallingProfilesSection />);
    const source = screen.getByTestId('softphone-connection-source');
    expect(source).toHaveTextContent('—');
    expect(source.textContent).not.toMatch(/undefined/i);
  });
});
