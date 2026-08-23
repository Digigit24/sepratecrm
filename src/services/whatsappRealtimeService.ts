// src/services/whatsappRealtimeService.ts
//
// Realtime WhatsApp delivery over Pusher, authorised END-TO-END by DigiCRM.
//
// How the auth works, start to finish:
//
//   1. The browser POSTs /api/whatsapp/realtime/grant/ with its ordinary user
//      JWT (crmClient attaches it). No body.
//   2. DigiCRM answers with { key, cluster, channel } — the public Pusher app
//      key and THE ONE private channel this tenant is allowed to join. The
//      client does not get to name the channel, so it cannot ask for another
//      tenant's stream.
//   3. pusher-js connects and, for that channel, calls our `authorizer`.
//   4. The authorizer POSTs the SAME grant endpoint again, now with
//      { socket_id, channel_name }, and DigiCRM returns the signed `auth`
//      string — scoped to that socket, that channel, and short-lived.
//
// What is deliberately absent: the tenant-wide vendor API token. The old path
// sent it as a bearer to Laravel's /api/broadcasting/auth, which meant every tab
// held a credential that could send messages as the business forever. It is not
// read here and must not be reintroduced.
//
// The grant endpoint is being built in parallel. If it 404/501/502/503s we stay
// silent and report `unavailable` — the chat still works, it just does not live
// update. Never a modal.

import Pusher from 'pusher-js';
import type { Channel } from 'pusher-js';
import {
  whatsappChatService,
  isWhatsappEndpointUnavailable,
  type RealtimeGrant,
} from '@/services/whatsappChatService';
import {
  normaliseWhatsAppMessage,
  type WhatsAppMessage,
  type WhatsAppMessageStatus,
} from '@/types/whatsapp/message';

export type RealtimeConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  /** The grant endpoint is not deployed yet — degrade quietly. */
  | 'unavailable';

export interface RealtimeMessageEvent {
  message: WhatsAppMessage;
  /** The conversation (wa_id) this message belongs to, when known. */
  contact: string | null;
}

export interface RealtimeStatusEvent {
  wamid: string | null;
  id: string | null;
  status: WhatsAppMessageStatus;
  error: string | null;
}

export interface RealtimeHandlers {
  onMessage?: (event: RealtimeMessageEvent) => void;
  onStatus?: (event: RealtimeStatusEvent) => void;
  onStateChange?: (state: RealtimeConnectionState) => void;
}

/** Events we bind on the private channel. Bound with and without the dot form. */
const MESSAGE_EVENTS = [
  'whatsapp.message',
  'message.received',
  'VendorChannelBroadcast',
] as const;

const STATUS_EVENTS = ['whatsapp.status', 'message.status'] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

const VALID_STATUSES: readonly string[] = ['pending', 'sent', 'delivered', 'read', 'failed'];

/**
 * A broadcast may be a full message envelope, or a `{ message, contact }`
 * wrapper, or (on the legacy Laravel channel) a bare NOTIFICATION carrying only
 * ids. We render what we can and let the caller refetch when there is no body.
 */
export function readMessageEvent(payload: unknown): RealtimeMessageEvent | null {
  const p = record(payload);
  const body = record(p.message).id || record(p.message).type ? p.message : p;
  const contact =
    str(p.contact) ??
    str(p.contactWaId) ??
    str(p.wa_id) ??
    str(record(p.contact).wa_id) ??
    str(record(body).contact) ??
    null;

  const b = record(body);
  // A pure notification (no type, no text, no wamid) is not renderable.
  const renderable =
    b.type !== undefined ||
    b.text !== undefined ||
    b.wamid !== undefined ||
    b.media !== undefined ||
    b.message !== undefined;
  if (!renderable) return null;

  return { message: normaliseWhatsAppMessage(body), contact };
}

export function readStatusEvent(payload: unknown): RealtimeStatusEvent | null {
  const p = record(payload);
  const m = record(p.message);
  const status = (
    str(p.status) ??
    str(m.status) ??
    str(p.message_status) ??
    ''
  ).toLowerCase();
  if (!VALID_STATUSES.includes(status)) return null;

  return {
    wamid: str(p.wamid) ?? str(m.wamid) ?? str(p.wa_message_id) ?? null,
    id: str(p.id) ?? str(m.id) ?? str(m.uid) ?? str(p.lastMessageUid) ?? null,
    status: status as WhatsAppMessageStatus,
    error: str(p.error) ?? str(m.error) ?? null,
  };
}

/**
 * One live subscription. Callers get a `stop()` and never touch Pusher directly.
 */
export interface RealtimeSubscription {
  stop: () => void;
  getState: () => RealtimeConnectionState;
}

export function subscribeToWhatsappRealtime(
  handlers: RealtimeHandlers,
): RealtimeSubscription {
  let pusher: Pusher | null = null;
  let channel: Channel | null = null;
  let stopped = false;
  let state: RealtimeConnectionState = 'idle';
  let grant: RealtimeGrant | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAttempt = 0;

  const setState = (next: RealtimeConnectionState) => {
    if (state === next) return;
    state = next;
    handlers.onStateChange?.(next);
  };

  const scheduleRetry = () => {
    if (stopped || retryTimer) return;
    // Capped exponential backoff — a backend that is still being built should
    // not be hammered, and the user should never see an error storm.
    const delay = Math.min(30_000, 2_000 * 2 ** Math.min(retryAttempt, 4));
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void start();
    }, delay);
  };

  const bindMessageHandlers = (ch: Channel) => {
    const onMessage = (payload: unknown) => {
      const event = readMessageEvent(payload);
      if (event) handlers.onMessage?.(event);
      // A broadcast can carry a status change alongside (or instead of) a body.
      const status = readStatusEvent(payload);
      if (status) handlers.onStatus?.(status);
    };

    for (const name of MESSAGE_EVENTS) {
      // Laravel broadcasts with a leading dot for raw (non-namespaced) names;
      // a plain Pusher publisher does not. Bind both — the dedupe on `wamid`
      // makes a double delivery harmless.
      ch.bind(name, onMessage);
      ch.bind(`.${name}`, onMessage);
    }

    for (const name of STATUS_EVENTS) {
      const onStatus = (payload: unknown) => {
        const status = readStatusEvent(payload);
        if (status) handlers.onStatus?.(status);
      };
      ch.bind(name, onStatus);
      ch.bind(`.${name}`, onStatus);
    }
  };

  const start = async () => {
    if (stopped) return;
    setState(state === 'disconnected' ? 'reconnecting' : 'connecting');

    try {
      grant = await whatsappChatService.getRealtimeGrant();
    } catch (error) {
      if (isWhatsappEndpointUnavailable(error)) {
        // Backend not deployed yet. Stay quiet; chat still works without live
        // updates. Retry slowly in case it lands while the tab is open.
        setState('unavailable');
        scheduleRetry();
        return;
      }
      setState('disconnected');
      scheduleRetry();
      return;
    }

    if (stopped) return;

    if (!grant.key || !grant.channel) {
      setState('unavailable');
      scheduleRetry();
      return;
    }

    try {
      pusher = new Pusher(grant.key, {
        cluster: grant.cluster || 'mt1',
        forceTLS: grant.force_tls ?? true,
        ...(grant.host ? { wsHost: grant.host } : {}),
        ...(grant.port ? { wsPort: grant.port } : {}),
        // The grant endpoint IS the authorizer. Each authorisation is a fresh,
        // socket-scoped, single-channel credential minted against the user's
        // JWT — nothing long-lived is ever held by the browser.
        authorizer: (ch) => ({
          authorize: (socketId, callback) => {
            whatsappChatService
              .getRealtimeGrant({ socket_id: socketId, channel_name: ch.name })
              .then((signed) => {
                if (!signed.auth) {
                  callback(new Error('Realtime grant returned no auth signature'), null);
                  return;
                }
                callback(null, {
                  auth: signed.auth,
                  ...(signed.channel_data ? { channel_data: signed.channel_data } : {}),
                });
              })
              .catch((error) => callback(error as Error, null));
          },
        }),
      });
    } catch {
      setState('disconnected');
      scheduleRetry();
      return;
    }

    pusher.connection.bind('connected', () => {
      retryAttempt = 0;
      setState('connected');
    });
    pusher.connection.bind('connecting', () => {
      if (state !== 'connected') setState('connecting');
    });
    pusher.connection.bind('unavailable', () => setState('reconnecting'));
    pusher.connection.bind('disconnected', () => setState('disconnected'));
    // pusher-js reconnects on its own; on a hard failure we re-mint the grant,
    // because the old signature is short-lived and may already be expired.
    pusher.connection.bind('failed', () => {
      setState('disconnected');
      teardownClient();
      scheduleRetry();
    });
    pusher.connection.bind('error', () => {
      if (state !== 'connected') setState('disconnected');
    });

    channel = pusher.subscribe(grant.channel);
    channel.bind('pusher:subscription_succeeded', () => {
      retryAttempt = 0;
      setState('connected');
    });
    channel.bind('pusher:subscription_error', () => {
      // Most often an expired grant. Drop everything and re-mint.
      setState('disconnected');
      teardownClient();
      scheduleRetry();
    });
    bindMessageHandlers(channel);
  };

  const teardownClient = () => {
    try {
      if (channel && pusher && grant?.channel) {
        channel.unbind_all();
        pusher.unsubscribe(grant.channel);
      }
      pusher?.disconnect();
    } catch {
      /* the socket is going away regardless */
    }
    channel = null;
    pusher = null;
  };

  void start();

  return {
    stop: () => {
      stopped = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      teardownClient();
      setState('idle');
    },
    getState: () => state,
  };
}
