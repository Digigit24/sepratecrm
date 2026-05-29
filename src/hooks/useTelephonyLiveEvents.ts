// src/hooks/useTelephonyLiveEvents.ts
//
// Subscribes to TeleCMI live call events (API doc §13 "live" webhook) once the
// backend pushes them to the browser. Today the backend only logs those events
// server-side, so this hook is a NO-OP by default and returns empty state.
//
// One-line wire-up later: set VITE_TELEPHONY_REALTIME=true (and have the backend
// broadcast on the Pusher channel `telephony.<tenant_id>`). No other code changes.
//
// Transport choice: a standalone pusher-js client on the app's existing Pusher
// account. We deliberately do NOT reuse the Laravel Echo instance (pusherService)
// — that is bound to the WhatsApp Laravel backend's private-channel auth, whereas
// telephony events originate from the Django CRM backend. A public Pusher channel
// needs no auth handshake, which keeps this seam backend-agnostic.

import { useEffect, useRef, useState, useCallback } from 'react';
import Pusher from 'pusher-js';
import { authService } from '@/services/authService';

export interface TelephonyLiveEvent {
  event: 'ringing' | 'answered' | 'ended';
  cmiuid: string;
  from?: string;
  duration?: number;
}

export interface TelephonyLiveState {
  /** Whether the realtime channel is currently connected. */
  connected: boolean;
  /** Most recent event received (null until one arrives). */
  lastEvent: TelephonyLiveEvent | null;
  /** Ring buffer of the last 10 events, newest last (debugging). */
  recentEvents: TelephonyLiveEvent[];
}

interface UseTelephonyLiveEventsOptions {
  /** Called for every live event received. */
  onEvent?: (event: TelephonyLiveEvent) => void;
}

const RING_BUFFER = 10;

// Same Pusher account the app already uses (see pusherService).
const PUSHER_KEY = '649db422ae8f2e9c7a9d';
const PUSHER_CLUSTER = 'ap2';

// Off by default — the backend doesn't broadcast telephony events yet.
const REALTIME_ENABLED = import.meta.env.VITE_TELEPHONY_REALTIME === 'true';

const normalizeEvent = (raw: unknown): TelephonyLiveEvent | null => {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const event = o.event;
  if (event !== 'ringing' && event !== 'answered' && event !== 'ended') return null;
  const cmiuid = o.cmiuid ?? o.cmiuuid ?? o.uuid;
  return {
    event,
    cmiuid: typeof cmiuid === 'string' ? cmiuid : '',
    from: typeof o.from === 'string' ? o.from : undefined,
    duration: typeof o.duration === 'number' ? o.duration : undefined,
  };
};

export const useTelephonyLiveEvents = (
  options?: UseTelephonyLiveEventsOptions,
): TelephonyLiveState => {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<TelephonyLiveEvent | null>(null);
  const [recentEvents, setRecentEvents] = useState<TelephonyLiveEvent[]>([]);

  // Keep the latest onEvent without re-subscribing on every render.
  const onEventRef = useRef(options?.onEvent);
  useEffect(() => {
    onEventRef.current = options?.onEvent;
  }, [options?.onEvent]);

  const handle = useCallback((raw: unknown) => {
    const evt = normalizeEvent(raw);
    if (!evt) return;
    setLastEvent(evt);
    setRecentEvents((prev) => [...prev, evt].slice(-RING_BUFFER));
    onEventRef.current?.(evt);
  }, []);

  useEffect(() => {
    // NO-OP path: realtime not enabled → log once at debug level, stay disconnected.
    if (!REALTIME_ENABLED) {
      if (import.meta.env.DEV) {
        console.debug('[telephony] live events disabled (set VITE_TELEPHONY_REALTIME=true to enable)');
      }
      return;
    }

    const tenant = authService.getTenant();
    const tenantId = tenant?.id || (tenant as { tenant_id?: string } | null)?.tenant_id;
    if (!tenantId) {
      if (import.meta.env.DEV) console.debug('[telephony] live events: no tenant id, skipping');
      return;
    }

    let pusher: Pusher | null = null;
    try {
      pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER, forceTLS: true });
      const channelName = `telephony.${tenantId}`;
      const channel = pusher.subscribe(channelName);

      pusher.connection.bind('connected', () => setConnected(true));
      pusher.connection.bind('disconnected', () => setConnected(false));
      pusher.connection.bind('unavailable', () => setConnected(false));

      // The backend may name the event with or without a leading dot.
      (['ringing', 'answered', 'ended', 'live', '.live'] as const).forEach((evtName) => {
        channel.bind(evtName, handle);
      });
    } catch (err) {
      // Graceful no-op: log once, never toast.
      if (import.meta.env.DEV) console.debug('[telephony] live events subscribe failed:', err);
      setConnected(false);
      return;
    }

    return () => {
      try {
        pusher?.disconnect();
      } catch {
        /* ignore */
      }
      setConnected(false);
    };
  }, [handle]);

  return { connected, lastEvent, recentEvents };
};

export default useTelephonyLiveEvents;
