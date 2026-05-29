// src/context/TelephonyProvider.tsx
//
// Owns the in-browser PIOPIY softphone: SBC login, the live call state machine
// (API doc §15), and the call-control actions. Registers a dispatcher with the
// telephony controller so placeCall() can prefer in-browser calls.
//
// SBC password is kept in memory only (never localStorage, never sent to our
// backend). On reload the user re-enters it via the softphone login form.

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
import { useTelephony } from '@/hooks/useTelephony';
import { useTelephonyLiveEvents, type TelephonyLiveEvent } from '@/hooks/useTelephonyLiveEvents';
import { TelephonyApiError } from '@/services/telephonyService';
import { setTelephonyDispatcher } from '@/lib/telephonyController';

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
  const { data: config, error: configError } = useWebRTCConfig();

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
    if (config) {
      // Only downgrade to needs-password if we aren't already logged in / on a call.
      setStatus((s) => (s === 'loading' || s === 'not-configured' ? 'needs-password' : s));
    } else if (configError instanceof TelephonyApiError && configError.isNotConfigured) {
      setStatus('not-configured');
    }
  }, [config, configError]);

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
      setStatus('needs-password');
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
  const login = useCallback(
    (password: string) => {
      const piopiy = piopiyRef.current;
      if (!piopiy || !config) return;
      setStatus('connecting');
      piopiy.login(config.telecmi_user_id, password, config.sbc_host); // password stays in this call only
    },
    [config],
  );

  const logout = useCallback(() => {
    piopiyRef.current?.logout();
    setStatus('needs-password');
    resetCall();
  }, [resetCall]);

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

  const value: TelephonyPhoneContextValue = {
    status,
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
