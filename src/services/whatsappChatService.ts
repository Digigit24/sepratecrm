// src/services/whatsappChatService.ts
//
// THE WhatsApp chat transport. Everything here goes through `crmClient`, i.e.
// DigiCRM, i.e. the user's own JWT + tenant headers.
//
// This module exists to replace the direct-to-Laravel path that authenticated
// with a long-lived, tenant-wide VENDOR API TOKEN kept in localStorage. That
// token granted full control of the tenant's WhatsApp Business account to
// anything that could read localStorage — one XSS was total account takeover.
// It is gone. Nothing in this file reads it, and nothing in this file may.
//
// Pinned DigiCRM contract:
//   POST /api/whatsapp/realtime/grant/            short-lived, single-channel
//                                                 Pusher credential
//   GET  /api/whatsapp/chat/?contact=&cursor=     paginated history, newest-last
//   POST /api/whatsapp/chat/send/                 text
//   POST /api/whatsapp/chat/send-template/        template + components
//   GET  /api/whatsapp/chat/conversations/        list + last message + unread
//   GET  /api/whatsapp/media/<id>/                AUTHENTICATED media proxy
//
// These endpoints are being built in parallel. Every call here must survive a
// backend that does not route the URL yet: see `isWhatsappEndpointUnavailable`,
// which mirrors the existing `isTelephonyEndpointUnavailable` /
// `isComposioUnavailable` precedent.

import type { AxiosError } from 'axios';
import { crmClient } from '@/lib/client';
import {
  normaliseWhatsAppMessage,
  normaliseWhatsAppMessages,
  sortWhatsAppMessages,
  type WhatsAppMessage,
  type WhatsAppTemplateComponent,
} from '@/types/whatsapp/message';

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class WhatsAppApiError extends Error {
  readonly status?: number;
  readonly data?: unknown;
  /** Backend-supplied human-readable reason, when there is one. */
  readonly backendError?: string;

  constructor(error: unknown, fallback = 'WhatsApp request failed') {
    const axiosError = error as AxiosError<Record<string, unknown>>;
    const status = axiosError?.response?.status;
    const data = axiosError?.response?.data;

    const backendError =
      (data && typeof data === 'object' && typeof data.error === 'string' && data.error) ||
      (data && typeof data === 'object' && typeof data.detail === 'string' && data.detail) ||
      undefined;

    super(backendError || axiosError?.message || fallback);
    this.name = 'WhatsAppApiError';
    this.status = status;
    this.data = data;
    this.backendError = backendError;
  }
}

/**
 * "This endpoint is not deployed on this backend yet."
 *
 * A 404/501/502/503 from the new chat surface means the parallel backend work
 * has not landed. The UI must degrade to a calm "not available yet" state —
 * never a white screen, never a modal, never a red crash toast.
 */
export const isWhatsappEndpointUnavailable = (error: unknown): boolean => {
  const status =
    error instanceof WhatsAppApiError
      ? error.status
      : (error as AxiosError)?.response?.status;
  return status === 404 || status === 501 || status === 502 || status === 503;
};

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

const BASE = '/whatsapp';

export const WHATSAPP_CHAT_PATHS = {
  REALTIME_GRANT: `${BASE}/realtime/grant/`,
  CHAT: `${BASE}/chat/`,
  SEND: `${BASE}/chat/send/`,
  SEND_TEMPLATE: `${BASE}/chat/send-template/`,
  CONVERSATIONS: `${BASE}/chat/conversations/`,
  MEDIA: (id: string) => `${BASE}/media/${encodeURIComponent(id)}/`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Response shapes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A short-lived, SINGLE-CHANNEL Pusher credential.
 *
 * The vendor token is never part of this response and must never be stored.
 * `channel` is the one channel this grant is good for — the client does not get
 * to pick, so a compromised browser cannot subscribe to another tenant.
 */
export interface RealtimeGrant {
  /** Pusher app key (public by design). */
  key: string;
  cluster: string;
  /**
   * The single private channel this grant authorises, VERBATIM — including the
   * mandatory `private-` prefix (e.g. `private-vendor-channel.<uid>`).
   *
   * Never reconstruct this client-side. Doing so is what produced the long-lived
   * bug where the frontend subscribed to `vendor-channel.<uid>` without the
   * prefix, which Pusher rejects outright however correct the auth is. Taking it
   * from the grant also lets the backend rename the channel without a frontend
   * release.
   */
  channel: string;
  /** Raw pusher-js event name to bind, e.g. `VendorChannelBroadcast`. */
  event: string | null;
  /** Laravel-Echo event name (leading dot), e.g. `.VendorChannelBroadcast`. */
  echo_event: string | null;
  /** ISO-8601 expiry, when the backend reports one. */
  expires_at?: string | null;
  /** Optional pre-signed auth, when the backend grants in one round trip. */
  auth?: string | null;
  channel_data?: string | null;
  /** Optional self-hosted (Reverb/soketi) overrides. */
  host?: string | null;
  port?: number | null;
  force_tls?: boolean | null;
}

export interface ChatHistoryPage {
  /** This page of messages, newest last. */
  messages: WhatsAppMessage[];
  /**
   * OPAQUE cursor (e.g. `"p2"`). Feed it back to walk further BACK in time.
   *
   * The pagination runs backwards: each successive page is OLDER than the last,
   * so pages must be PREPENDED to the transcript, never appended. Null when the
   * beginning of the conversation has been reached.
   */
  nextCursor: string | null;
  hasMore: boolean;
  /** Backend-authoritative 24-hour window state for this conversation. */
  window: ConversationWindow;
}

/**
 * The single normalised 24-hour-window field set the backend now returns.
 *
 * Historically the frontend guessed this from the last inbound message, and the
 * expiry was silently dropped on a key-name mismatch
 * (`reply_window_expires_at` vs `window_expires_at`). We read the normalised
 * field and keep the heuristic only as a fallback (see getWindowState.ts).
 */
export interface ConversationWindow {
  open: boolean | null;
  expiresAt: string | null;
  requiresTemplate: boolean | null;
  /** Backend-rendered "closes in 3 hours" string, when supplied. */
  expiresHuman?: string | null;
}

export interface ConversationSummary {
  /** WhatsApp id (E.164, no '+'). The conversation key. */
  wa_id: string;
  name: string | null;
  last_message: WhatsAppMessage | null;
  unread_count: number;
  updated_at: string | null;
}

export interface SendResult {
  message: WhatsAppMessage | null;
  wamid: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/**
 * Pull the 24-hour window state out of the payload.
 *
 * The CANONICAL source is the `reply_window` object
 * `{ open, expires_at, requires_template, expires_human }`. The backend also
 * emits the older flat aliases for compatibility with the currently-deployed
 * frontend, so we fall back through them — this is exactly the key-name
 * mismatch (`reply_window_expires_at` vs `window_expires_at`) that used to make
 * every "closes in 3h" countdown render nothing.
 */
export function readConversationWindow(payload: unknown): ConversationWindow {
  const p = record(payload);
  const canonical = record(p.reply_window);
  const nested = record(p.window);
  // Canonical object first; then a `window` wrapper; then the flat top level.
  const source =
    Object.keys(canonical).length > 0
      ? canonical
      : Object.keys(nested).length > 0
        ? nested
        : p;

  return {
    open:
      bool(source.open) ??
      bool(source.window_open) ??
      bool(source.reply_window_open) ??
      bool(source.is_reply_window_open),
    expiresAt:
      str(source.expires_at) ??
      str(source.window_expires_at) ??
      str(source.reply_window_expires_at),
    requiresTemplate: bool(source.requires_template),
    expiresHuman:
      str(source.expires_human) ?? str(source.reply_window_expires_human),
  };
}

/** Messages may arrive as a bare array, `.messages`, or a DRF page. */
function readMessageList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const p = record(payload);
  if (Array.isArray(p.messages)) return p.messages;
  if (Array.isArray(p.results)) return p.results;
  if (Array.isArray(p.data)) return p.data;
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

class WhatsAppChatService {
  /**
   * Mint a short-lived, single-channel Pusher credential.
   *
   * Called with no socket id, this returns the CONNECTION parameters (app key,
   * cluster, and the one channel this tenant may join). Called with a socket id
   * and channel name it acts as the Pusher `authorizer` and returns the signed
   * `auth` string. Same endpoint, both roles — so the browser never holds a
   * credential that outlives the socket.
   */
  async getRealtimeGrant(params?: {
    socket_id?: string;
    channel_name?: string;
  }): Promise<RealtimeGrant> {
    try {
      const res = await crmClient.post<Record<string, unknown>>(
        WHATSAPP_CHAT_PATHS.REALTIME_GRANT,
        params ?? {},
        { suppressErrorToast: true },
      );
      const d = record(res.data);
      return {
        key: str(d.key) ?? str(d.app_key) ?? '',
        cluster: str(d.cluster) ?? '',
        channel: str(d.channel) ?? str(d.channel_name) ?? '',
        event: str(d.event),
        echo_event: str(d.echo_event),
        expires_at: str(d.expires_at),
        auth: str(d.auth),
        channel_data: str(d.channel_data),
        host: str(d.host),
        port: typeof d.port === 'number' ? d.port : null,
        force_tls: bool(d.force_tls),
      };
    } catch (error) {
      throw new WhatsAppApiError(error, 'Could not obtain a realtime grant');
    }
  }

  /**
   * Paginated history for one contact, NEWEST LAST within the page.
   *
   * Successive pages go BACKWARDS in time — see `ChatHistoryPage.nextCursor`.
   */
  async getChatHistory(params: {
    contact: string;
    cursor?: string | null;
  }): Promise<ChatHistoryPage> {
    const search = new URLSearchParams({ contact: params.contact });
    if (params.cursor) search.set('cursor', params.cursor);

    try {
      const res = await crmClient.get<Record<string, unknown>>(
        `${WHATSAPP_CHAT_PATHS.CHAT}?${search.toString()}`,
        { suppressErrorToast: true },
      );
      // NB: read the list from the RAW body, not from `record(...)` — `record`
      // collapses an array to `{}`, which would silently drop every message
      // when the backend answers with a bare array.
      const d = record(res.data);
      const messages = sortWhatsAppMessages(normaliseWhatsAppMessages(readMessageList(res.data)));
      const nextCursor = str(d.next_cursor) ?? str(d.cursor) ?? str(d.previous);

      return {
        messages,
        nextCursor,
        hasMore: d.has_more === true || (nextCursor !== null && nextCursor !== ''),
        window: readConversationWindow(d),
      };
    } catch (error) {
      throw new WhatsAppApiError(error, 'Could not load chat history');
    }
  }

  /**
   * Send a free-form text message.
   *
   * `client_id` is echoed back by the backend so the optimistic local row can be
   * reconciled with the confirmed one (and with the Pusher broadcast) instead of
   * appearing twice.
   */
  async sendText(params: {
    contact: string;
    text: string;
    client_id?: string;
    reply_to?: string | null;
  }): Promise<SendResult> {
    try {
      const res = await crmClient.post<Record<string, unknown>>(
        WHATSAPP_CHAT_PATHS.SEND,
        {
          contact: params.contact,
          text: params.text,
          ...(params.client_id ? { client_id: params.client_id } : {}),
          ...(params.reply_to ? { reply_to: params.reply_to } : {}),
        },
        { suppressErrorToast: true },
      );
      return readSendResult(res.data, params.client_id);
    } catch (error) {
      throw new WhatsAppApiError(error, 'Message could not be sent');
    }
  }

  /** Send an approved template with its resolved components. */
  async sendTemplate(params: {
    contact: string;
    template_uid?: string;
    template_name?: string;
    language?: string;
    components?: WhatsAppTemplateComponent[];
    client_id?: string;
  }): Promise<SendResult> {
    try {
      const res = await crmClient.post<Record<string, unknown>>(
        WHATSAPP_CHAT_PATHS.SEND_TEMPLATE,
        {
          contact: params.contact,
          ...(params.template_uid ? { template_uid: params.template_uid } : {}),
          ...(params.template_name ? { template_name: params.template_name } : {}),
          ...(params.language ? { language: params.language } : {}),
          components: params.components ?? [],
          ...(params.client_id ? { client_id: params.client_id } : {}),
        },
        { suppressErrorToast: true },
      );
      return readSendResult(res.data, params.client_id);
    } catch (error) {
      throw new WhatsAppApiError(error, 'Template could not be sent');
    }
  }

  /** Conversation list with last message + unread count. */
  async getConversations(): Promise<ConversationSummary[]> {
    try {
      const res = await crmClient.get<Record<string, unknown>>(
        WHATSAPP_CHAT_PATHS.CONVERSATIONS,
        { suppressErrorToast: true },
      );
      const d = res.data;
      const list = Array.isArray(d)
        ? d
        : Array.isArray(record(d).results)
          ? (record(d).results as unknown[])
          : Array.isArray(record(d).conversations)
            ? (record(d).conversations as unknown[])
            : [];

      return list.map((entry) => {
        const c = record(entry);
        const last = c.last_message ?? c.lastMessage ?? null;
        return {
          wa_id: str(c.wa_id) ?? str(c.contact) ?? str(c.phone) ?? '',
          name: str(c.name) ?? str(c.full_name) ?? null,
          last_message: last ? normaliseWhatsAppMessage(last) : null,
          unread_count:
            typeof c.unread_count === 'number'
              ? c.unread_count
              : typeof c.unread_messages_count === 'number'
                ? c.unread_messages_count
                : 0,
          updated_at: str(c.updated_at) ?? str(c.last_message_at) ?? null,
        };
      });
    } catch (error) {
      throw new WhatsAppApiError(error, 'Could not load conversations');
    }
  }

  /**
   * Fetch media through the AUTHENTICATED proxy and return an object URL.
   *
   * Never link Laravel's public `/api/{vendorUid}/media/{filename}` route: it
   * ignores the vendor uid, does no path containment, and is an unauthenticated
   * arbitrary file read (it will happily serve `.env`, which holds the key that
   * decrypts every tenant's Meta credentials).
   *
   * Caller owns the returned URL and must `URL.revokeObjectURL` it.
   */
  async fetchMediaObjectUrl(
    mediaId: string,
    fallbackMime = 'application/octet-stream',
  ): Promise<{ url: string; mimeType: string }> {
    try {
      const res = await crmClient.get(WHATSAPP_CHAT_PATHS.MEDIA(mediaId), {
        responseType: 'blob',
        suppressErrorToast: true,
      });
      const mimeType =
        (res.headers as Record<string, string> | undefined)?.['content-type'] || fallbackMime;
      const blob = new Blob([res.data as BlobPart], { type: mimeType });
      return { url: URL.createObjectURL(blob), mimeType };
    } catch (error) {
      throw new WhatsAppApiError(error, 'Could not load media');
    }
  }
}

/** Read a send response into a normalised message + wamid. */
function readSendResult(payload: unknown, clientId?: string): SendResult {
  const d = record(payload);
  const messageSource = d.message ?? d.data ?? (d.id || d.wamid ? d : null);
  const wamid = str(d.wamid) ?? str(d.wa_message_id) ?? str(record(d.message).wamid);

  if (!messageSource) return { message: null, wamid };

  const message = normaliseWhatsAppMessage({
    ...record(messageSource),
    // Carry the client id through so the optimistic row is matched, not doubled.
    client_id: str(record(messageSource).client_id) ?? clientId ?? null,
    direction: 'out',
  });

  return { message, wamid: wamid ?? message.wamid };
}

export const whatsappChatService = new WhatsAppChatService();
