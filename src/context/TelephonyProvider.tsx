// src/context/TelephonyProvider.tsx
//
// Owns the in-browser PIOPIY softphone: SBC login, the live call state machine
// (API doc §15), and the call-control actions. Registers a dispatcher with the
// telephony controller so placeCall() can prefer in-browser calls.
//
// The SBC credential is kept in memory ONLY — never localStorage/sessionStorage,
// never logged, never in a URL. When the backend supplies it (webrtc-config
// `auth`) we log in automatically; when it does not, the user types it into the
// softphone login form and it still only ever lives in the piopiy.login() call.

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { toast } from 'sonner';
import PIOPIY, { type PiopiyEventPayload } from 'piopiyjs';
import {
  useTelephony,
  isTelephonyMarkedNotConfigured,
  markTelephonyNotConfigured,
  clearTelephonyNotConfigured,
  TELEPHONY_NOT_CONFIGURED_RECHECK_MS,
} from '@/hooks/useTelephony';
import { useTelephonyLiveEvents, type TelephonyLiveEvent } from '@/hooks/useTelephonyLiveEvents';
import { TelephonyApiError } from '@/services/telephonyService';
import { setTelephonyDispatcher } from '@/lib/telephonyController';
import { telephonyNotConfiguredMessage } from '@/types/telephony.types';
import type {
  TelephonyNotConfiguredReason,
  WebRTCConfigSource,
} from '@/types/telephony.types';

export type PhoneStatus =
  | 'loading' // resolving webrtc-config
  | 'not-configured' // 424 — no agent / tenant not connected
  | 'needs-password' // config OK, awaiting SBC login
  | 'connecting' // login in flight
  | 'ready' // logged in, idle
  | 'dialling' // outbound, pre-ring
  | 'ringing-outbound'
  | 'ringing-inbound'
  | 'active'
  | 'on-hold';

export interface CallMeta {
  number: string;
  direction: 'inbound' | 'outbound';
  leadId?: number;
  cmiuid?: string;
}

export interface TelephonyPhoneContextValue {
  status: PhoneStatus;
  /** TeleCMI is configured for this tenant (webrtc-config resolved). */
  isTelephonyConfigured: boolean;
  /** webrtc-config request still in flight (initial resolution). */
  isTelephonyLoading: boolean;
  /**
   * Human-readable configuration error, or null.
   * For the expected 424 "not configured" state this is a friendly message,
   * not an error dump — UI should render it as a neutral state, e.g. disabled
   * calling controls with "Telephony not configured".
   */
  telephonyConfigurationError: string | null;
  /**
   * Which of the two expected 424 states we are in, when status is
   * 'not-configured'. `null` means "not configured, reason unknown" (older
   * backend) or a non-424 failure — see `telephonyConfigurationError`.
   */
  notConfiguredReason: TelephonyNotConfiguredReason | null;
  /**
   * 'tenant' => connected as the workspace's shared extension rather than a
   * per-user one. Surface this quietly so the user knows who they call as.
   */
  configSource: WebRTCConfigSource | null;
  /** True when the server supplies the SBC credential (no password prompt). */
  hasServerAuth: boolean;
  telecmiUserId: string | null;
  sbcHost: string | null;
  defaultCallerId: string | null;
  currentCall: CallMeta | null;
  durationSec: number;
  isMuted: boolean;
  isOnHold: boolean;
  transferInitiated: boolean;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  /** Whether the realtime live-events channel is connected (false until backend ships it). */
  liveConnected: boolean;
  // actions
  login: (password: string) => void;
  logout: () => void;
  /**
   * Explicit, event-driven refresh: tear down any live SDK session, re-fetch
   * webrtc-config, and re-login with the new values. Call it after telephony
   * settings are saved — no page reload, no re-login required.
   *
   * This is deliberately imperative: the provider still fires at most one
   * webrtc-config request per mount on its own. It never polls.
   */
  reconnect: () => Promise<void>;
  dial: (params: { toNumber: string; leadId?: number }) => void;
  answer: () => void;
  reject: () => void;
  hangUp: () => void;
  hold: () => void;
  unhold: () => void;
  mute: () => void;
  unmute: () => void;
  sendDtmf: (digit: string) => void;
  transfer: (to: string) => void;
  merge: () => void;
}

const TelephonyPhoneContext = createContext<TelephonyPhoneContextValue | undefined>(undefined);

const MAX_NOT_CONFIGURED_AUTO_RECHECKS = 4;

/**
 * If the SBC never answers our login, drop back to a usable state instead of
 * spinning forever. A failed reconnect must always leave a retry path.
 */
const LOGIN_TIMEOUT_MS = 20_000;

export const useTelephonyPhone = (): TelephonyPhoneContextValue => {
  const ctx = useContext(TelephonyPhoneContext);
  if (!ctx) throw new Error('useTelephonyPhone must be used within a TelephonyProvider');
  return ctx;
};

const readNumber = (p: PiopiyEventPayload): string => {
  const v = p.from ?? p.number ?? p.callerid ?? p.caller ?? '';
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
};
const readCmiuid = (p: PiopiyEventPayload): string | undefined => {
  const v = p.cmiuid ?? p.cmiuuid ?? p.uuid;
  return typeof v === 'string' ? v : undefined;
};

export const TelephonyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { useWebRTCConfig } = useTelephony();

  // SINGLE OWNER of webrtc-config loading. This provider is only mounted when
  // the telephony module is enabled (TelephonyShell in App.tsx), and it skips
  // the request entirely when a recent 424 already told us TeleCMI is not
  // configured for the tenant (short-lived session flag). Result: dashboard
  // load fires AT MOST one webrtc-config request — zero when the
  // not-configured state is already known, then a small capped number of
  // re-checks after quiet periods. Child components must read config state from this context.
  const [skipConfigFetch, setSkipConfigFetch] =
    useState<boolean>(() => isTelephonyMarkedNotConfigured());
  const {
    data: config,
    error: configError,
    isLoading: configIsLoading,
    mutate: recheckConfig,
  } =
    useWebRTCConfig(!skipConfigFetch);

  // True only while an explicit reconnect() is re-fetching. It freezes the
  // "config -> status" effect so a stale `config` (SWR keeps the previous value
  // during revalidation) cannot trigger a login with the OLD credential.
  const [isReconnecting, setIsReconnecting] = useState(false);
  // Armed once per mount and once per reconnect(). Guarantees exactly one
  // automatic login attempt per config resolution — never a retry loop.
  const [autoLoginArmed, setAutoLoginArmed] = useState(true);

  const piopiyRef = useRef<PIOPIY | null>(null);
  const [status, setStatus] = useState<PhoneStatus>('loading');
  const [currentCall, setCurrentCall] = useState<CallMeta | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [transferInitiated, setTransferInitiated] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Stable refs for use inside event handlers / dispatcher (avoid stale closures).
  const statusRef = useRef<PhoneStatus>('loading');
  const callStartRef = useRef<number | null>(null);
  const pendingDialRef = useRef<CallMeta | null>(null);
  const currentCallRef = useRef<CallMeta | null>(null);
  const notConfiguredRetriesRef = useRef(0);
  const reconnectSeqRef = useRef(0);
  // Kept in a ref so reconnect() never has to be re-created when SWR swaps its
  // bound mutate identity (which would churn every consumer of the context).
  const recheckConfigRef = useRef(recheckConfig);
  recheckConfigRef.current = recheckConfig;
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    currentCallRef.current = currentCall;
  }, [currentCall]);

  const resetCall = useCallback(() => {
    setCurrentCall(null);
    setIsMuted(false);
    setIsOnHold(false);
    setTransferInitiated(false);
    setDurationSec(0);
    callStartRef.current = null;
    pendingDialRef.current = null;
  }, []);

  // ── resolve config -> initial status ──
  useEffect(() => {
    // While an explicit reconnect is in flight, `config` may still be the
    // pre-save value. Don't act on it — reconnect() re-runs this effect by
    // clearing isReconnecting once the fresh value has landed.
    if (isReconnecting) return;

    if (skipConfigFetch) {
      // Known not-configured from a recent 424 — zero requests this mount.
      setStatus('not-configured');
      return;
    }
    if (config) {
      // Config resolved — TeleCMI IS configured; clear any stale flag.
      clearTelephonyNotConfigured();
      notConfiguredRetriesRef.current = 0;
      // Only downgrade to needs-password if we aren't already logged in / on a call.
      setStatus((s) => (s === 'loading' || s === 'not-configured' ? 'needs-password' : s));
    } else if (configError instanceof TelephonyApiError && configError.isNotConfigured) {
      // Expected 424: handled silently (no toast, no retry — see READ_OPTIONS
      // and the 424-aware axios logging in lib/client.ts). Remember it so
      // remounts/navigation don't re-request for the rest of the session.
      // `notConfiguredReason` below decides which of the two states we render.
      markTelephonyNotConfigured();
      setStatus('not-configured');
    } else if (configError) {
      // Any other failure (500, network, CORS…). Never leave the widget on a
      // permanent spinner — land somewhere the user can retry from.
      setStatus((s) => (s === 'loading' ? 'not-configured' : s));
    }
  }, [isReconnecting, skipConfigFetch, config, configError]);

  // A 424 can be transient immediately after login. Re-enable a skipped fetch,
  // or revalidate a fetch that returned 424, after a short quiet period. Stop
  // after a small number of consecutive 424s for tenants that genuinely do not
  // have TeleCMI configured.
  useEffect(() => {
    if (isReconnecting) return;
    const isNotConfiguredError =
      configError instanceof TelephonyApiError && configError.isNotConfigured;
    if (!skipConfigFetch && !isNotConfiguredError) return;
    if (notConfiguredRetriesRef.current >= MAX_NOT_CONFIGURED_AUTO_RECHECKS) return;
    notConfiguredRetriesRef.current += 1;

    const timer = window.setTimeout(() => {
      clearTelephonyNotConfigured();
      setStatus('loading');
      if (skipConfigFetch) {
        setSkipConfigFetch(false);
      } else {
        void recheckConfig();
      }
    }, TELEPHONY_NOT_CONFIGURED_RECHECK_MS);

    return () => window.clearTimeout(timer);
  }, [isReconnecting, skipConfigFetch, configError, recheckConfig]);

  // ── create the PIOPIY instance + bind events once config is available ──
  useEffect(() => {
    if (!config || piopiyRef.current) return;

    const piopiy = new PIOPIY({ name: 'CRM Agent', debug: false, autoplay: true, ringTime: 60 });
    piopiyRef.current = piopiy;

    piopiy.on('login', ({ code }) => {
      if (code === 200) setStatus('ready');
      else {
        setStatus('needs-password');
        toast.error(`Softphone login failed (code ${code ?? '?'})`);
      }
    });
    piopiy.on('loginFailed', ({ code }) => {
      setStatus('needs-password');
      toast.error(`Softphone login failed (code ${code ?? '?'})`);
    });
    piopiy.on('logout', () => {
      // Don't stomp on a reconnect that has already moved us to 'loading' —
      // teardown calls logout() on purpose before re-logging-in.
      setStatus((s) => (s === 'loading' || s === 'not-configured' ? s : 'needs-password'));
      resetCall();
    });

    piopiy.on('inComingCall', (payload) => {
      setCurrentCall({ number: readNumber(payload), direction: 'inbound', cmiuid: readCmiuid(payload) });
      setStatus('ringing-inbound');
      setPanelOpen(true);
    });

    piopiy.on('trying', () => setStatus('dialling'));
    piopiy.on('ringing', () => setStatus('ringing-outbound'));

    piopiy.on('answered', () => {
      callStartRef.current = Date.now();
      setDurationSec(0);
      setStatus('active');
    });

    piopiy.on('hold', () => setStatus('on-hold'));
    piopiy.on('unhold', () => setStatus('active'));

    piopiy.on('hangup', () => {
      setStatus((s) => (s === 'needs-password' || s === 'not-configured' ? s : 'ready'));
      resetCall();
    });
    piopiy.on('ended', ({ code }) => {
      if (code !== undefined && code !== 200) toast.warning(`Call ended (code ${code})`);
      setStatus((s) => (s === 'needs-password' || s === 'not-configured' ? s : 'ready'));
      resetCall();
    });
  }, [config, resetCall]);

  // ── duration ticker (runs while a call is connected, incl. on hold) ──
  useEffect(() => {
    if ((status !== 'active' && status !== 'on-hold') || callStartRef.current == null) return;
    const id = window.setInterval(() => {
      if (callStartRef.current != null) {
        setDurationSec(Math.floor((Date.now() - callStartRef.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // ── reconcile backend live events (§13) with current call state ──
  // Strictly matches the active call's cmiuid. For in-browser piopiy calls the
  // SDK already drives these transitions; these webhook events are an idempotent
  // safety net and the *primary* signal for click-to-call REST flows once the
  // backend correlates request_id -> cmiuid and broadcasts.
  const handleLiveEvent = useCallback(
    (e: TelephonyLiveEvent) => {
      const cur = currentCallRef.current;
      if (!cur || !e.cmiuid || cur.cmiuid !== e.cmiuid) return;

      if (e.event === 'ringing') {
        if (statusRef.current === 'dialling') setStatus('ringing-outbound');
      } else if (e.event === 'answered') {
        if (statusRef.current !== 'active' && statusRef.current !== 'on-hold') {
          if (callStartRef.current == null) {
            callStartRef.current = Date.now();
            setDurationSec(0);
          }
          setStatus('active');
        }
      } else if (e.event === 'ended') {
        setStatus((s) => (s === 'needs-password' || s === 'not-configured' ? s : 'ready'));
        resetCall();
      }
    },
    [resetCall],
  );

  const live = useTelephonyLiveEvents({ onEvent: handleLiveEvent });

  // ── actions ──
  //
  // `secret` is either the server-supplied auth.value (kind 'token' or
  // 'password' — piopiy.login() takes both in the same slot) or something the
  // user typed. Either way it lives in this call only: never stored, never
  // logged, never sent anywhere else.
  const login = useCallback(
    (secret: string) => {
      const piopiy = piopiyRef.current;
      if (!piopiy || !config || !secret) return;
      setStatus('connecting');
      piopiy.login(config.telecmi_user_id, secret, config.sbc_host); // secret stays in this call only
    },
    [config],
  );

  /**
   * Drop any live SDK session so we never stack two registrations on the SBC.
   * Safe to call when we were never logged in — the SDK may throw in that case.
   */
  const teardownSession = useCallback(() => {
    try {
      piopiyRef.current?.logout();
    } catch {
      /* not logged in — nothing to tear down */
    }
    resetCall();
  }, [resetCall]);

  const logout = useCallback(() => {
    setAutoLoginArmed(false); // an explicit logout must not be undone by auto-login
    teardownSession();
    setStatus('needs-password');
  }, [teardownSession]);

  /**
   * Explicit refresh (see the context docs). Tears the session down, re-fetches
   * webrtc-config, then re-arms exactly one automatic login with the new
   * values. Never throws — a failed reconnect resolves into a retryable state.
   */
  const reconnect = useCallback(async () => {
    const seq = ++reconnectSeqRef.current;

    teardownSession();
    clearTelephonyNotConfigured();
    notConfiguredRetriesRef.current = 0;
    setIsReconnecting(true);
    setAutoLoginArmed(true);
    setStatus('loading');
    // If a previous 424 had unbound the SWR key, re-bind it; SWR then fetches
    // on the next render. If it is already bound, the mutate() below refetches.
    setSkipConfigFetch(false);

    try {
      await recheckConfigRef.current?.();
    } catch {
      // The error is surfaced through SWR's `error` (configError) — the
      // config effect turns it into a rendered state with a retry path.
    } finally {
      // Ignore stale reconnects: only the newest one may release the freeze.
      if (reconnectSeqRef.current === seq) setIsReconnecting(false);
    }
  }, [teardownSession]);

  const dial = useCallback(({ toNumber, leadId }: { toNumber: string; leadId?: number }) => {
    const piopiy = piopiyRef.current;
    if (!piopiy || statusRef.current !== 'ready') return;
    const num = toNumber.replace(/\D/g, '');
    if (!num) return;
    pendingDialRef.current = { number: num, direction: 'outbound', leadId };
    setCurrentCall({ number: num, direction: 'outbound', leadId });
    setStatus('dialling');
    setPanelOpen(true);
    piopiy.call(num, leadId != null ? { lead_id: String(leadId) } : undefined);
  }, []);

  const answer = useCallback(() => piopiyRef.current?.answer(), []);
  const reject = useCallback(() => {
    piopiyRef.current?.reject();
    setStatus((s) => (s === 'needs-password' || s === 'not-configured' ? s : 'ready'));
    resetCall();
  }, [resetCall]);
  const hangUp = useCallback(() => {
    piopiyRef.current?.terminate();
    setStatus((s) => (s === 'needs-password' || s === 'not-configured' ? s : 'ready'));
    resetCall();
  }, [resetCall]);
  const hold = useCallback(() => {
    piopiyRef.current?.hold();
    setIsOnHold(true);
  }, []);
  const unhold = useCallback(() => {
    piopiyRef.current?.unHold();
    setIsOnHold(false);
  }, []);
  const mute = useCallback(() => {
    piopiyRef.current?.mute();
    setIsMuted(true);
  }, []);
  const unmute = useCallback(() => {
    piopiyRef.current?.unMute();
    setIsMuted(false);
  }, []);
  const sendDtmf = useCallback((digit: string) => piopiyRef.current?.sendDtmf(digit), []);
  const transfer = useCallback((to: string) => {
    const num = to.replace(/\D/g, '');
    if (!num) return;
    piopiyRef.current?.transfer(num);
    setTransferInitiated(true);
  }, []);
  const merge = useCallback(() => piopiyRef.current?.merge(), []);

  // ── automatic login when the server supplies the credential ──
  // Both auth kinds ('token' and 'password') go into the same piopiy.login()
  // slot; the SDK does not care which it is. Armed exactly once per mount and
  // once per reconnect(), so a rejected credential never becomes a retry loop —
  // the user gets an explicit Retry instead.
  useEffect(() => {
    if (!autoLoginArmed || isReconnecting) return;
    if (status !== 'needs-password') return;
    const secret = config?.auth?.value;
    if (!secret) return; // backend has not shipped `auth` — fall back to the login form
    setAutoLoginArmed(false);
    login(secret);
  }, [autoLoginArmed, isReconnecting, status, config, login]);

  // ── login watchdog ──
  // The SBC can silently never answer (bad host, blocked WSS). Without this the
  // widget sits on 'connecting' forever with no way back.
  useEffect(() => {
    if (status !== 'connecting') return;
    const timer = window.setTimeout(() => {
      setStatus((s) => (s === 'connecting' ? 'needs-password' : s));
      toast.error('Softphone could not reach the SBC — try connecting again.');
    }, LOGIN_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  // ── register dispatcher for placeCall() (non-React callers) ──
  useEffect(() => {
    setTelephonyDispatcher({
      getStatus: () => statusRef.current,
      call: ({ toNumber, leadId }) => {
        if (statusRef.current !== 'ready') return false;
        dial({ toNumber, leadId });
        return true;
      },
    });
    return () => setTelephonyDispatcher(null);
  }, [dial]);

  // ── derived configuration state (exposed for widgets/pages) ──
  const notConfiguredError =
    configError instanceof TelephonyApiError && configError.isNotConfigured ? configError : null;
  // A 424 without a recognised `reason` (older backend) stays null so the UI
  // renders the generic — still non-alarming — copy.
  const notConfiguredReason: TelephonyNotConfiguredReason | null =
    notConfiguredError?.notConfiguredReason ?? null;

  const isTelephonyConfigured = !!config && status !== 'not-configured';
  const isTelephonyLoading = (!skipConfigFetch && configIsLoading) || isReconnecting;
  const telephonyConfigurationError = skipConfigFetch
    ? 'Telephony not configured'
    : notConfiguredError
      ? telephonyNotConfiguredMessage(notConfiguredReason)
      : configError instanceof Error
        ? configError.message
        : null;

  const value: TelephonyPhoneContextValue = {
    status,
    isTelephonyConfigured,
    isTelephonyLoading,
    telephonyConfigurationError,
    notConfiguredReason,
    configSource: config?.source ?? null,
    hasServerAuth: !!config?.auth?.value,
    telecmiUserId: config?.telecmi_user_id ?? null,
    sbcHost: config?.sbc_host ?? null,
    defaultCallerId: config?.default_caller_id ?? null,
    currentCall,
    durationSec,
    isMuted,
    isOnHold,
    transferInitiated,
    panelOpen,
    setPanelOpen,
    liveConnected: live.connected,
    login,
    logout,
    reconnect,
    dial,
    answer,
    reject,
    hangUp,
    hold,
    unhold,
    mute,
    unmute,
    sendDtmf,
    transfer,
    merge,
  };

  return <TelephonyPhoneContext.Provider value={value}>{children}</TelephonyPhoneContext.Provider>;
};

export default TelephonyProvider;
