// src/components/telephony/Softphone.tsx
// Global floating in-browser softphone. Mounted once in the layout.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneCall,
  X,
  Mic,
  MicOff,
  Pause,
  Play,
  Grid3x3,
  ArrowRightLeft,
  Loader2,
  LogOut,
  Settings,
  RefreshCw,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTelephonyPhone, type PhoneStatus } from '@/context/TelephonyProvider';
import { useAuth } from '@/hooks/useAuth';
import { useTelephony } from '@/hooks/useTelephony';
import { isAdminUser, hasPermissionForResource } from '@/lib/permissions';
import {
  TELEPHONY_NOT_CONFIGURED_COPY,
  isSharedTelephonyIdentity,
  type CallingProfile,
} from '@/types/telephony.types';
import { SoftphoneLeadContext } from './SoftphoneLeadContext';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const launcherColor = (status: PhoneStatus): string => {
  switch (status) {
    case 'ready':
      return 'bg-green-600 hover:bg-green-700';
    case 'active':
    case 'on-hold':
    case 'dialling':
    case 'ringing-outbound':
      return 'bg-blue-600 hover:bg-blue-700 animate-pulse';
    case 'ringing-inbound':
      return 'bg-red-600 hover:bg-red-700 animate-pulse';
    case 'needs-password':
    case 'connecting':
      return 'bg-amber-500 hover:bg-amber-600';
    default:
      return 'bg-muted-foreground hover:bg-muted-foreground/90';
  }
};

/**
 * Embedded mode = the widget IS the whole page (crmflutter's WebView loads
 * /telephony/embed and nothing else).
 *
 * Three things have to change when that is true, and they are all about the
 * fact that there is no surrounding app:
 *   - no launcher button. The launcher exists to summon the panel over a page;
 *     embedded, the panel is the page, and a user who saw only a 48px circle
 *     in the corner of an otherwise blank WebView would reasonably think it
 *     had failed to load.
 *   - the panel fills the viewport instead of floating bottom-right at 320px.
 *   - no close button. Closing would leave a genuinely blank screen with no
 *     way back, since there is no app behind it.
 */
const EmbeddedContext = React.createContext(false);
const useEmbedded = () => React.useContext(EmbeddedContext);

export interface SoftphoneProps {
  /** Render as a full-viewport page rather than a floating overlay. */
  embedded?: boolean;
}

export const Softphone: React.FC<SoftphoneProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const phone = useTelephonyPhone();
  const { status, panelOpen, setPanelOpen } = phone;

  // Embedded has no launcher, so nothing would ever open the panel.
  React.useEffect(() => {
    if (embedded && !panelOpen) setPanelOpen(true);
  }, [embedded, panelOpen, setPanelOpen]);

  return (
    <EmbeddedContext.Provider value={embedded}>
      {/* Launcher — pointless embedded: the panel is already the page. */}
      {!embedded && (
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        aria-label="Open softphone"
        className={cn(
          'fixed bottom-5 right-5 z-[60] h-12 w-12 rounded-full shadow-lg text-white flex items-center justify-center transition-colors',
          launcherColor(status),
        )}
      >
        {status === 'ringing-inbound' ? (
          <PhoneIncoming className="h-5 w-5" />
        ) : status === 'active' || status === 'on-hold' ? (
          <PhoneCall className="h-5 w-5" />
        ) : (
          <Phone className="h-5 w-5" />
        )}
      </button>
      )}

      {/* Panel */}
      {panelOpen && (
        <div
          className={cn(
            'z-[60] bg-card overflow-y-auto overflow-x-hidden',
            embedded
              // Fill the WebView. No rounding/shadow/offsets — there is no
              // page behind it to float above.
              ? 'fixed inset-0 w-full h-[100dvh] max-h-none border-0'
              : 'fixed bottom-20 right-5 w-[calc(100vw-2.5rem)] sm:w-[320px] max-w-[360px] rounded-xl border shadow-2xl max-h-[calc(100vh-7rem)]',
          )}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Softphone</span>
              {/* Dev-only live-channel indicator (hidden in production builds) */}
              {import.meta.env.DEV && (
                <span
                  className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    phone.liveConnected ? 'bg-green-500' : 'bg-muted-foreground/40',
                  )}
                  title={`Live: ${phone.liveConnected ? 'connected' : 'disconnected'}`}
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              {status === 'ready' && (
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Log out" onClick={phone.logout}>
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              )}
              {/* Closing embedded would leave a blank WebView with no way back. */}
              {!embedded && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPanelOpen(false)} aria-label="Close">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className={cn(embedded ? 'p-4' : 'p-3')}>
            {embedded && <ProfileSwitcher />}
            <SoftphoneBody navigate={navigate} />
          </div>
        </div>
      )}
    </EmbeddedContext.Provider>
  );
};

/**
 * Admin-only line picker, rendered above the dialler on the embed page.
 *
 * Why an assignment and not a client-side toggle
 * ----------------------------------------------
 * `GET /telephony/webrtc-config` takes no parameters — the SERVER decides which
 * extension you register as, walking: your own agent row, then a profile
 * assigned to you, then the tenant default. The client cannot ask for a
 * specific profile, so a purely local "selected profile" would relabel the UI
 * while the phone stayed registered as whatever the server picked. That is a
 * worse bug than no switcher at all: the admin would believe they were dialling
 * from the support line and the customer would see the sales number.
 *
 * So switching writes the real thing — `POST /calling-profiles/<id>/assign/`
 * with the admin's own user id — and then calls `reconnect()`. The backend
 * drops the cached TeleCMI token on assign, so the next webrtc-config genuinely
 * re-resolves and the softphone re-registers on the new extension.
 *
 * Consequences, both intended:
 *  - the choice PERSISTS. Reload the WebView and you are still on that line.
 *  - it is the same assignment an admin sets in Settings, so the two surfaces
 *    agree instead of holding separate opinions about who is on which line.
 *
 * Who sees it
 * -----------
 * Admins with more than one profile to choose between. A regular user with an
 * assigned profile sees nothing — same gate as the Calling Profiles card
 * (`isAdminUser || telephony.settings.edit`), no new role concept — and the
 * backend refuses non-admin assigns with 403 regardless, so this is a UI
 * courtesy on top of a real check rather than the check itself.
 */
const ProfileSwitcher: React.FC = () => {
  const phone = useTelephonyPhone();
  const { user } = useAuth();
  const { useCallingProfiles, useCallingProfileAssignments, assignCallingProfile } = useTelephony();

  const isAdmin = isAdminUser(user) || hasPermissionForResource(user, 'telephony.settings.edit');
  const userId = user?.id ?? null;
  // Only admins ever fetch these — a regular user on the embed page should not
  // spend two requests discovering it has nothing to show them.
  const enabled = isAdmin && !!userId;

  const { data: profilesData } = useCallingProfiles(enabled);
  const { data: assignmentsData, mutate: mutateAssignments } = useCallingProfileAssignments(enabled);
  const [switching, setSwitching] = useState(false);

  const profiles = React.useMemo<CallingProfile[]>(
    () => (Array.isArray(profilesData) ? profilesData.filter((p) => p.is_active) : []),
    [profilesData],
  );

  const assignedId = React.useMemo(() => {
    if (!Array.isArray(assignmentsData) || !userId) return null;
    return assignmentsData.find((a) => a.user_id === userId)?.profile_id ?? null;
  }, [assignmentsData, userId]);

  // What the phone is actually on right now: an explicit assignment if there is
  // one, else whichever profile the server would have fallen back to.
  const activeId = assignedId ?? profiles.find((p) => p.is_default)?.id ?? null;

  const onSelect = async (value: string) => {
    const id = Number(value);
    if (!userId || !Number.isFinite(id) || id === activeId) return;
    setSwitching(true);
    try {
      await assignCallingProfile(id, userId);
      await mutateAssignments();
      // Re-resolve webrtc-config and re-REGISTER. Without this the UI would
      // show the new line while the SIP session stayed on the old extension.
      await phone.reconnect();
    } catch {
      // assignCallingProfile has already toasted; leaving the select on the old
      // value is correct, because the old value is still what the phone is on.
    } finally {
      setSwitching(false);
    }
  };

  // Nothing to choose between is not a switcher, it is clutter.
  if (!enabled || profiles.length < 2) return null;

  // A personal agent row (resolution step 1) OUTRANKS any assignment, so
  // switching would silently do nothing. Say so rather than offering a control
  // that appears to work.
  if (phone.configSource === 'user') {
    return (
      <p
        data-testid="softphone-profile-switcher-blocked"
        className="mb-4 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <Users className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          You are on your own TeleCMI extension, which takes priority over calling
          profiles. Remove it under Settings → My Telephony to pick a line here.
        </span>
      </p>
    );
  }

  return (
    <div className="mb-4 space-y-1.5" data-testid="softphone-profile-switcher">
      <Label className="text-xs text-muted-foreground">Calling from</Label>
      <Select
        value={activeId != null ? String(activeId) : undefined}
        onValueChange={onSelect}
        disabled={switching}
      >
        <SelectTrigger className="h-12" aria-label="Calling profile">
          <SelectValue placeholder="Choose a line" />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.label}
              {p.caller_id ? ` — ${p.caller_id}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {switching && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Reconnecting on the new line…
        </p>
      )}
    </div>
  );
};

const SoftphoneBody: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const phone = useTelephonyPhone();
  const { status } = phone;

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'not-configured') {
    return <NotConfigured navigate={navigate} />;
  }

  if (status === 'needs-password' || status === 'connecting') {
    return <LoginForm />;
  }

  if (status === 'ringing-inbound') {
    return <IncomingCall />;
  }

  if (status === 'dialling' || status === 'ringing-outbound') {
    return <OutgoingCall />;
  }

  if (status === 'active' || status === 'on-hold') {
    return <ActiveCall />;
  }

  // ready
  return <Dialpad />;
};

/**
 * The expected "can't call yet" states. These are NOT crashes — no red toast,
 * no raw 424. The two 424 reasons need different copy and different actions:
 *  - tenant_not_configured => a workspace-level admin job
 *  - no_agent              => this user needs their own extension
 * Anything else (unknown reason, 500, network) falls back to neutral copy plus
 * a Retry, so the widget is never a dead end.
 */
const NotConfigured: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const phone = useTelephonyPhone();
  const { hasPermission, isAdminLike } = useAuth();
  const reason = phone.notConfiguredReason;
  const copy = reason ? TELEPHONY_NOT_CONFIGURED_COPY[reason] : null;

  // Only point at workspace telephony setup if the user could actually do it.
  const canConfigureWorkspace = isAdminLike() || hasPermission('telephony.settings.edit');
  // 'no_agent' is about the user's own record — always reachable in Settings.
  const showSettingsLink = reason === 'no_agent' || canConfigureWorkspace;

  return (
    <div
      data-testid="softphone-not-configured"
      data-reason={reason ?? 'unknown'}
      className="text-center py-4 space-y-2"
    >
      <p className="text-sm font-medium">
        {copy?.title ?? "Telephony isn't available right now"}
      </p>
      <p className="text-xs text-muted-foreground">
        {copy?.detail ??
          phone.telephonyConfigurationError ??
          'We could not load your calling settings. Try again in a moment.'}
      </p>
      <div className="flex gap-2 justify-center pt-1">
        {showSettingsLink && (
          <Button size="sm" onClick={() => navigate('/admin/settings')}>
            <Settings className="h-3.5 w-3.5 mr-2" />
            Open Settings
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => void phone.reconnect()}>
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Retry
        </Button>
      </div>
    </div>
  );
};

/**
 * Quiet note: this session is on the workspace's shared extension.
 *
 * Covers every shared source — 'tenant_profile', 'tenant_default' and the
 * deprecated 'tenant' alias. Comparing against a single literal here silently
 * stopped firing the moment the backend split the value, which is exactly the
 * kind of drift `isSharedTelephonyIdentity` exists to prevent.
 */
const TenantIdentityNote: React.FC = () => {
  const phone = useTelephonyPhone();
  if (!isSharedTelephonyIdentity(phone.configSource)) return null;
  return (
    <p
      data-testid="softphone-tenant-identity-note"
      className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
    >
      <Users className="h-3 w-3 mt-0.5 shrink-0" />
      <span>
        Connected as the workspace's shared extension
        {phone.telecmiUserId ? <> (<span className="font-mono">{phone.telecmiUserId}</span>)</> : null}.
      </span>
    </p>
  );
};

const LoginForm: React.FC = () => {
  const phone = useTelephonyPhone();
  const [password, setPassword] = useState('');
  const connecting = phone.status === 'connecting';

  // When the server supplies the credential the provider logs in on its own —
  // showing a password box here would be both wrong and confusing. Landing on
  // this branch with hasServerAuth means the attempt failed, so offer a retry.
  if (phone.hasServerAuth) {
    return (
      <div data-testid="softphone-server-auth" className="space-y-3 py-2 text-center">
        <p className="text-sm font-medium">
          {connecting ? 'Connecting your softphone…' : 'Softphone is not connected'}
        </p>
        <p className="text-xs text-muted-foreground">
          Signing in as <span className="font-mono">{phone.telecmiUserId ?? '—'}</span>
        </p>
        <Button
          className="w-full"
          disabled={connecting}
          onClick={() => void phone.reconnect()}
        >
          {connecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {connecting ? 'Connecting…' : 'Try again'}
        </Button>
        <TenantIdentityNote />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">TeleCMI User ID</Label>
        <Input value={phone.telecmiUserId ?? ''} readOnly className="h-8 text-xs font-mono bg-muted" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="sp-password" className="text-xs">Password</Label>
        <Input
          id="sp-password"
          type="password"
          autoComplete="off"
          placeholder="SBC password (this session only)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && password && phone.login(password)}
        />
      </div>
      <Button className="w-full" disabled={!password || connecting} onClick={() => phone.login(password)}>
        {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Phone className="h-4 w-4 mr-2" />}
        Connect
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Password is kept in memory only — re-enter after a reload.
      </p>
      <TenantIdentityNote />
    </div>
  );
};

const Dialpad: React.FC = () => {
  const phone = useTelephonyPhone();
  const embedded = useEmbedded();
  const [number, setNumber] = useState('');

  // Touch targets. The overlay's 40px keys are fine under a mouse; on a phone
  // they are below the ~44px minimum and sit 8px apart, which is a misdial
  // waiting to happen. Embedded gets 56px keys and the space to use them,
  // since the panel now owns the whole viewport.
  return (
    <div className={cn(embedded ? 'space-y-4' : 'space-y-3')}>
      <Input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="Enter number"
        inputMode="tel"
        autoComplete="tel"
        className={cn('text-center font-mono', embedded && 'h-14 text-2xl tracking-wider')}
        onKeyDown={(e) => e.key === 'Enter' && number && phone.dial({ toNumber: number })}
      />
      <div className={cn('grid grid-cols-3', embedded ? 'gap-3' : 'gap-2')}>
        {DIAL_KEYS.map((k) => (
          <Button
            key={k}
            variant="outline"
            className={cn('font-medium', embedded ? 'h-14 text-xl' : 'h-10 text-base')}
            onClick={() => setNumber((n) => n + k)}
          >
            {k}
          </Button>
        ))}
      </div>
      <div className={cn('flex', embedded ? 'gap-3' : 'gap-2')}>
        <Button
          variant="outline"
          className={cn('flex-1', embedded && 'h-14 text-xl')}
          disabled={!number}
          onClick={() => setNumber((n) => n.slice(0, -1))}
        >
          ⌫
        </Button>
        <Button
          className={cn('flex-1 bg-green-600 hover:bg-green-700', embedded && 'h-14 text-base')}
          disabled={!number}
          onClick={() => phone.dial({ toNumber: number })}
        >
          <Phone className={cn('mr-2', embedded ? 'h-5 w-5' : 'h-4 w-4')} />
          Call
        </Button>
      </div>
      {/* Workspace-identity footnote is app context, not dialling. Embedded the
          ask was "only dialler and calling option", so it goes. */}
      {!embedded && <TenantIdentityNote />}
    </div>
  );
};

const IncomingCall: React.FC = () => {
  const phone = useTelephonyPhone();
  return (
    <div className="text-center space-y-3 py-2">
      <PhoneIncoming className="h-8 w-8 mx-auto text-red-600 animate-pulse" />
      <div>
        <p className="text-xs text-muted-foreground">Incoming call</p>
        <p className="text-base font-semibold font-mono">{phone.currentCall?.number || 'Unknown'}</p>
      </div>
      <SoftphoneLeadContext leadId={phone.currentCall?.leadId} number={phone.currentCall?.number} />
      <div className="flex gap-2">
        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={phone.answer}>
          <Phone className="h-4 w-4 mr-2" />
          Accept
        </Button>
        <Button variant="destructive" className="flex-1" onClick={phone.reject}>
          <PhoneOff className="h-4 w-4 mr-2" />
          Decline
        </Button>
      </div>
    </div>
  );
};

const OutgoingCall: React.FC = () => {
  const phone = useTelephonyPhone();
  return (
    <div className="text-center space-y-3 py-2">
      <PhoneCall className="h-8 w-8 mx-auto text-blue-600 animate-pulse" />
      <div>
        <p className="text-xs text-muted-foreground">
          {phone.status === 'ringing-outbound' ? 'Ringing…' : 'Calling…'}
        </p>
        <p className="text-base font-semibold font-mono">{phone.currentCall?.number}</p>
      </div>
      <SoftphoneLeadContext leadId={phone.currentCall?.leadId} number={phone.currentCall?.number} />
      <Button variant="destructive" className="w-full" onClick={phone.hangUp}>
        <PhoneOff className="h-4 w-4 mr-2" />
        Cancel
      </Button>
    </div>
  );
};

const ActiveCall: React.FC = () => {
  const phone = useTelephonyPhone();
  const [showDtmf, setShowDtmf] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-base font-semibold font-mono">{phone.currentCall?.number}</p>
        <p className="text-xs text-muted-foreground">
          {phone.isOnHold ? 'On hold · ' : ''}
          {fmt(phone.durationSec)}
        </p>
      </div>

      <SoftphoneLeadContext leadId={phone.currentCall?.leadId} number={phone.currentCall?.number} />

      <div className="grid grid-cols-3 gap-2">
        <Button variant={phone.isMuted ? 'default' : 'outline'} className="h-12 flex-col gap-1" onClick={phone.isMuted ? phone.unmute : phone.mute}>
          {phone.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span className="text-[10px]">{phone.isMuted ? 'Unmute' : 'Mute'}</span>
        </Button>
        <Button variant={phone.isOnHold ? 'default' : 'outline'} className="h-12 flex-col gap-1" onClick={phone.isOnHold ? phone.unhold : phone.hold}>
          {phone.isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          <span className="text-[10px]">{phone.isOnHold ? 'Resume' : 'Hold'}</span>
        </Button>
        <Button variant={showDtmf ? 'default' : 'outline'} className="h-12 flex-col gap-1" onClick={() => setShowDtmf((v) => !v)}>
          <Grid3x3 className="h-4 w-4" />
          <span className="text-[10px]">Keypad</span>
        </Button>
      </div>

      {showDtmf && (
        <div className="grid grid-cols-3 gap-1.5">
          {DIAL_KEYS.map((k) => (
            <Button key={k} variant="outline" size="sm" className="h-8" onClick={() => phone.sendDtmf(k)}>
              {k}
            </Button>
          ))}
        </div>
      )}

      {showTransfer ? (
        <div className="flex gap-1.5">
          <Input
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            placeholder="Transfer to…"
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8" disabled={!transferTo} onClick={() => phone.transfer(transferTo)}>
            Transfer
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowTransfer(true)}>
          <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
          Transfer
        </Button>
      )}

      {phone.transferInitiated && (
        <Button variant="outline" size="sm" className="w-full" onClick={phone.merge}>
          Merge calls
        </Button>
      )}

      <Button variant="destructive" className="w-full" onClick={phone.hangUp}>
        <PhoneOff className="h-4 w-4 mr-2" />
        Hang up
      </Button>
    </div>
  );
};

export default Softphone;
