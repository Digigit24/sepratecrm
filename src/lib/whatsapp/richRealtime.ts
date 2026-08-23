// src/lib/whatsapp/richRealtime.ts
//
// Turning DigiCRM's rich broadcast into a rendered message WITHOUT a refetch.
//
// Background, because the two events look interchangeable and are not:
//
//   Laravel's `VendorChannelBroadcast` is a NOTIFICATION. It carries
//   {contactUid, contactWaId, isNewIncomingMessage, lastMessageUid} and nothing
//   else — no body, no wamid. The only thing a client can do with it is refetch
//   the conversation, which is what the Chats page has always done.
//
//   DigiCRM's `DigicrmMessage` is the MESSAGE. It carries the full pinned
//   envelope, byte-identical to `GET /api/whatsapp/chat/`, published from
//   DigiCRM's own inbound webhook. It can be rendered straight from the socket.
//
// Both fire for the same inbound message. This module holds the rules that let
// the rich one win and the thin one stand down, plus the two places where the
// rich one is NOT trustworthy enough to render as-is.
//
// Realtime remains an accelerator, never the source of truth: every rule here
// degrades to "fetch it" rather than to "show something wrong".

import {
  normaliseWhatsAppMessage,
  type WhatsAppMessage,
} from '@/types/whatsapp/message';

/**
 * How long the thin Laravel event waits to see whether the rich one is coming.
 *
 * DigiCRM publishes after n8n has relayed the webhook, so its event usually
 * lands slightly AFTER Laravel's. Firing the thin refetch immediately would
 * therefore refetch every message even when the rich event was about to render
 * it for free — i.e. the whole change would be a no-op in practice.
 *
 * The wait is only ever applied once a rich event has been seen on this page
 * (see `hasSeenRichEvent`), so a backend that does not publish them keeps
 * today's immediate-refetch behaviour with zero added latency.
 */
export const RICH_GRACE_MS = 600;

/** Media types that are meaningless without a media block. */
const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'document', 'sticker']);

// ─── Thin-event coordination ────────────────────────────────────────────────
// Module state on purpose: every mounted consumer of the channel has to agree
// about whether a refetch is still needed, and a per-hook copy would let two
// components each fire the refetch the third one just cancelled.

let richEventSeen = false;
const pendingThinRefetch = new Map<string, ReturnType<typeof setTimeout>>();

/** A rich event arrived, so DigiCRM's publisher is live on this deployment. */
export function markRichEventSeen(): void {
  richEventSeen = true;
}

/**
 * Run the thin event's refetch - now, or after the grace window.
 *
 * Immediately while no rich event has ever been seen, so a backend without the
 * publisher behaves exactly as it does today. Once one has, the refetch waits
 * long enough for the rich event describing the SAME message to arrive and
 * cancel it, which is the whole saving.
 */
export function scheduleThinRefetch(key: string, refetch: () => void): void {
  if (!richEventSeen) {
    refetch();
    return;
  }
  if (pendingThinRefetch.has(key)) return;
  const timer = setTimeout(() => {
    pendingThinRefetch.delete(key);
    refetch();
  }, RICH_GRACE_MS);
  pendingThinRefetch.set(key, timer);
}

/** The rich event got here first; the thin one has nothing left to fetch. */
export function cancelThinRefetch(key: string): void {
  const timer = pendingThinRefetch.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    pendingThinRefetch.delete(key);
  }
}

/** Test-only. Module state outlives a React unmount, which tests must not. */
export function __resetThinRefetchCoordination(): void {
  richEventSeen = false;
  pendingThinRefetch.forEach((timer) => clearTimeout(timer));
  pendingThinRefetch.clear();
}

export interface RichMessageEvent {
  message: WhatsAppMessage;
  /** wa_id of the conversation, when the publisher named one. */
  contactWaId: string | null;
  contactUid: string | null;
  /** The server shrank this payload past Pusher's 10KB limit. */
  truncated: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Read one `DigicrmMessage` payload.
 *
 * Returns null for anything that is not a renderable message — a bare
 * notification that somehow arrived on this event name must not become an empty
 * bubble.
 */
export function readRichMessage(payload: unknown): RichMessageEvent | null {
  const p = asRecord(payload);
  const body = asRecord(p.message);
  if (Object.keys(body).length === 0) return null;

  // `normaliseWhatsAppMessage` accepts the DigiCRM envelope natively (it checks
  // the contract field names before the legacy Laravel ones), so this is a
  // validation pass rather than a conversion.
  const message = normaliseWhatsAppMessage(body);

  return {
    message,
    contactWaId: asString(p.contact) ?? asString(p.contactWaId) ?? asString(p.wa_id),
    contactUid: asString(p.contact_uid) ?? asString(p.contactUid),
    truncated: body.truncated === true,
  };
}

/**
 * Should this message be refetched instead of rendered?
 *
 * Two real causes, both of which we created ourselves and so must handle:
 *
 *   1. `truncated: true` — DigiCRM shrank the payload to fit Pusher's 10KB
 *      hard limit, so the template/contacts/interactive blocks are gone and the
 *      text may be cut. Rendering it would show a silently wrong message.
 *
 *   2. The n8n fidelity gap. DigiCRM's webhook is fed by an n8n workflow that
 *      currently only pins `phone`, `message_body`, `message_wamid`. An inbound
 *      image therefore arrives as a media-typed envelope with no media block —
 *      or, worse, as a `text` envelope with no text at all. Either way the
 *      envelope is thinner than its own type promises.
 *
 * The answer is a NARROW refetch of that one message, never the conversation.
 * Anything else is guesswork dressed up as data.
 */
export function needsSingleMessageRefetch(event: RichMessageEvent): boolean {
  if (event.truncated) return true;

  const { message } = event;

  if (MEDIA_TYPES.has(message.type) && !message.media) return true;
  if (message.type === 'location' && !message.location) return true;
  if (message.type === 'contacts' && !message.contacts) return true;
  if (message.type === 'template' && !message.template) return true;
  if ((message.type === 'interactive' || message.type === 'button') && !message.interactive) {
    return true;
  }
  // A message with no content of any kind. Not renderable, and not something to
  // guess about.
  if (message.type === 'unsupported' && !message.text) return true;
  if (message.type === 'text' && !message.text) return true;

  return false;
}

/**
 * The cache row shape for `chatKeys.messages(contactUid, {})`.
 *
 * Deliberately BOTH shapes at once: the envelope verbatim (which
 * `normaliseWhatsAppMessage` prefers, so ChatWindow renders media, location,
 * contacts, interactive and template at full fidelity) plus the legacy Laravel
 * aliases the existing `useMessages` transform reads. Writing only one of the
 * two would silently blank half the renderer.
 */
export function envelopeToCacheRow(
  message: WhatsAppMessage,
  contactUid: string | null,
): Record<string, unknown> {
  return {
    _uid: message.id,
    contact_uid: contactUid ?? undefined,
    is_incoming_message: message.direction === 'in',
    message_type: message.type,
    message_body: message.text ?? '',
    messaged_at: message.timestamp,
    created_at: message.timestamp,
    media_values: message.media ?? undefined,
    whatsapp_message_error: message.error ?? undefined,
    // The envelope last: its field names are the ones the renderer prefers.
    ...message,
  };
}

/**
 * Every identity a row answers to, most specific first: wamid, then the
 * optimistic echo's client_id, then whichever server id the row carries.
 *
 * Exported because the same rule has to hold in useMessages' cache-sync dedupe:
 * two places deduping the same rows by different keys is how a message ends up
 * on screen twice.
 */
export function messageIdentities(input: unknown): string[] {
  const row = asRecord(input);
  const keys: string[] = [];
  const wamid = asString(row.wamid) ?? asString(row.wa_message_id) ?? asString(row.whatsapp_message_id);
  const clientId = asString(row.client_id);
  const id = asString(row.id) ?? asString(row._uid) ?? asString(row.uid);
  if (wamid) keys.push(`wamid:${wamid}`);
  if (clientId) keys.push(`cid:${clientId}`);
  if (id) keys.push(`id:${id}`);
  return keys;
}

/**
 * Merge one realtime row into the cached message list without duplicating it.
 *
 * Identity is `wamid -> client_id -> id`, in that order, because up to three
 * sightings describe the same message: the optimistic local echo (client_id
 * only), Laravel's thin event via a refetch (server id, and a wamid), and
 * DigiCRM's rich event (wamid + id). Matching on `id` alone — which is what the
 * live path used to do — cannot collapse an echo, because the echo has no
 * server id yet.
 */
export function mergeRowIntoMessages<T extends Record<string, unknown>>(
  existing: T[],
  incoming: Record<string, unknown>,
): T[] {
  const keys = messageIdentities(incoming);
  if (keys.length === 0) return [...existing, incoming as unknown as T];

  const index = existing.findIndex((row) =>
    messageIdentities(row).some((key) => keys.includes(key)),
  );

  if (index === -1) return [...existing, incoming as unknown as T];

  const previous = existing[index];
  const merged = {
    ...previous,
    ...incoming,
    // Never lose an identity we already learned: the echo owns the client_id,
    // the broadcast owns the wamid, and a later sighting of either must still
    // match this row.
    client_id: incoming.client_id ?? previous.client_id,
    wamid: incoming.wamid ?? previous.wamid,
  } as unknown as T;

  const next = [...existing];
  next[index] = merged;
  return next;
}
