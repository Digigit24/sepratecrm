// src/types/whatsapp/message.ts
//
// THE normalised WhatsApp message envelope — the single shape every renderer,
// hook and realtime consumer in this app agrees on.
//
// It mirrors the DigiCRM contract exactly:
//
//   { id, wamid, direction, type, status, timestamp, text,
//     media:{url,mime,filename,caption}, location:{lat,lng,name,address},
//     contacts:[…], interactive:{…}, template:{name,components},
//     reply_to, error }
//
// `normaliseWhatsAppMessage` accepts BOTH that shape and the several legacy
// shapes still flowing through the app (the direct-Laravel inbox payload, the
// Django lead-chat payload, and the Pusher broadcast payload) so the rendering
// layer never has to know which backend produced a row.
//
// Design rule: normalisation NEVER throws and NEVER returns null. An unknown or
// malformed row degrades to `type:'unsupported'` while keeping whatever text it
// had. A blank bubble is a bug; an "unsupported message" row is not.

/** The 11 WhatsApp message types we render, plus the catch-all. */
export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'template'
  | 'unsupported';

/** Every type we know how to render, in contract order. Useful for tests. */
export const WHATSAPP_MESSAGE_TYPES: readonly WhatsAppMessageType[] = [
  'text',
  'image',
  'video',
  'audio',
  'document',
  'sticker',
  'location',
  'contacts',
  'interactive',
  'button',
  'template',
  'unsupported',
] as const;

/** Outbound delivery lifecycle. Inbound messages have no meaningful status. */
export type WhatsAppMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type WhatsAppMessageDirection = 'in' | 'out';

export interface WhatsAppMedia {
  /** Media identifier or URL — always resolved through the AUTHENTICATED proxy. */
  url: string;
  mime?: string | null;
  filename?: string | null;
  caption?: string | null;
  /** Byte size, when the backend knows it. */
  size?: number | null;
}

export interface WhatsAppLocation {
  lat: number;
  lng: number;
  name?: string | null;
  address?: string | null;
}

/** A single vCard entry from a `contacts` message. */
export interface WhatsAppContactCard {
  name?: {
    formatted_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  phones?: Array<{ phone?: string | null; type?: string | null; wa_id?: string | null }> | null;
  emails?: Array<{ email?: string | null; type?: string | null }> | null;
  org?: { company?: string | null; title?: string | null } | null;
  addresses?: Array<Record<string, unknown>> | null;
  urls?: Array<{ url?: string | null; type?: string | null }> | null;
}

/** A rendered button on an interactive / button / template message. */
export interface WhatsAppButton {
  /** 'reply' | 'url' | 'phone_number' | 'quick_reply' | … */
  type?: string | null;
  text: string;
  /** Present for URL buttons. */
  url?: string | null;
  phone_number?: string | null;
  /** Present when the recipient actually pressed this button. */
  selected?: boolean;
}

/** A row inside an interactive LIST message. */
export interface WhatsAppListRow {
  id?: string | null;
  title: string;
  description?: string | null;
}

export interface WhatsAppListSection {
  title?: string | null;
  rows: WhatsAppListRow[];
}

export interface WhatsAppInteractive {
  /** 'button' | 'list' | 'button_reply' | 'list_reply' | 'nfm_reply' | … */
  type?: string | null;
  header?: { type?: string | null; text?: string | null; media?: WhatsAppMedia | null } | null;
  body?: string | null;
  footer?: string | null;
  buttons?: WhatsAppButton[] | null;
  /** For LIST messages: the label on the "open list" control. */
  button_text?: string | null;
  sections?: WhatsAppListSection[] | null;
  /** For a reply: what the recipient chose. */
  reply?: { id?: string | null; title?: string | null; description?: string | null } | null;
}

/** A Meta template component, as it appears in `template_data.components`. */
export interface WhatsAppTemplateComponent {
  /** 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' (case-insensitive in the wild). */
  type?: string | null;
  /** For HEADER: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION'. */
  format?: string | null;
  text?: string | null;
  buttons?: WhatsAppButton[] | null;
  parameters?: unknown;
  example?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface WhatsAppTemplatePayload {
  name?: string | null;
  components?: WhatsAppTemplateComponent[] | null;
  /** Resolved {{n}} values, when the backend sends them separately. */
  component_values?: unknown[] | null;
  language?: string | null;
}

export interface WhatsAppMessage {
  /** Stable local row id. Falls back to `wamid` then a synthesised key. */
  id: string;
  /** Meta's message id. THE dedupe key between an optimistic echo and its broadcast. */
  wamid: string | null;
  direction: WhatsAppMessageDirection;
  type: WhatsAppMessageType;
  status: WhatsAppMessageStatus | null;
  /** ISO-8601. Always a valid parseable string (falls back to epoch-safe now). */
  timestamp: string;
  text: string | null;
  media: WhatsAppMedia | null;
  location: WhatsAppLocation | null;
  contacts: WhatsAppContactCard[] | null;
  interactive: WhatsAppInteractive | null;
  template: WhatsAppTemplatePayload | null;
  /** wamid of the message this one replies to. */
  reply_to: string | null;
  /** Failure reason, present when `status === 'failed'`. */
  error: string | null;
  /**
   * Client-generated id for an optimistic local echo. Present ONLY while the
   * row is unconfirmed; used to reconcile/roll back the send.
   */
  client_id?: string | null;
  /** True while this row is a local echo that the server has not confirmed. */
  pending?: boolean;
  /** The original type string when we had to fall back to 'unsupported'. */
  raw_type?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_TYPES = new Set<string>(WHATSAPP_MESSAGE_TYPES);

const STATUS_ALIASES: Record<string, WhatsAppMessageStatus> = {
  pending: 'pending',
  queued: 'pending',
  accepted: 'sent',
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  seen: 'read',
  failed: 'failed',
  error: 'failed',
  undelivered: 'failed',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Coerce anything into a valid ISO-8601 string. Never returns "Invalid Date". */
function normaliseTimestamp(value: unknown): string {
  const raw = asString(value);
  if (raw) {
    // Unix seconds (Meta sends these as a numeric string).
    if (/^\d{10}$/.test(raw)) return new Date(Number(raw) * 1000).toISOString();
    if (/^\d{13}$/.test(raw)) return new Date(Number(raw)).toISOString();
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: 10-digit values are seconds, 13-digit are millis.
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function normaliseDirection(raw: Record<string, unknown>): WhatsAppMessageDirection {
  const direct = asString(raw.direction)?.toLowerCase();
  if (direct === 'in' || direct === 'inbound' || direct === 'incoming') return 'in';
  if (direct === 'out' || direct === 'outbound' || direct === 'outgoing') return 'out';

  // Legacy Laravel flag.
  const incoming = raw.is_incoming_message ?? raw.is_incoming;
  if (typeof incoming === 'boolean') return incoming ? 'in' : 'out';
  if (incoming === 1 || incoming === '1') return 'in';
  if (incoming === 0 || incoming === '0') return 'out';

  const from = asString(raw.from)?.toLowerCase();
  if (from === 'me') return 'out';
  if (from === 'them') return 'in';

  return 'out';
}

function normaliseStatus(value: unknown): WhatsAppMessageStatus | null {
  const raw = asString(value)?.toLowerCase();
  if (!raw) return null;
  return STATUS_ALIASES[raw] ?? null;
}

function normaliseMedia(raw: Record<string, unknown>): WhatsAppMedia | null {
  // Contract shape first.
  const contract = asRecord(raw.media);
  const legacy = asRecord(raw.media_values);
  const source = Object.keys(contract).length > 0 ? contract : legacy;
  if (Object.keys(source).length === 0) return null;

  const url =
    asString(source.url) ??
    asString(source.link) ??
    asString(source.media_url) ??
    asString(source.id) ??
    asString(source.media_id);
  if (!url) return null;

  return {
    url,
    mime: asString(source.mime) ?? asString(source.mime_type) ?? asString(source.type) ?? null,
    filename:
      asString(source.filename) ??
      asString(source.file_name) ??
      asString(source.original_filename) ??
      null,
    caption: asString(source.caption) ?? null,
    size: asNumber(source.size) ?? asNumber(source.file_size) ?? null,
  };
}

function normaliseLocation(raw: Record<string, unknown>): WhatsAppLocation | null {
  const source = asRecord(raw.location);
  if (Object.keys(source).length === 0) return null;
  const lat = asNumber(source.lat) ?? asNumber(source.latitude);
  const lng = asNumber(source.lng) ?? asNumber(source.longitude) ?? asNumber(source.long);
  if (lat === null || lng === null) return null;
  return {
    lat,
    lng,
    name: asString(source.name) ?? null,
    address: asString(source.address) ?? null,
  };
}

function normaliseContacts(raw: Record<string, unknown>): WhatsAppContactCard[] | null {
  const source = raw.contacts;
  if (!Array.isArray(source) || source.length === 0) return null;
  return source.map((entry) => {
    const c = asRecord(entry);
    const name = asRecord(c.name);
    return {
      name: {
        formatted_name:
          asString(name.formatted_name) ?? asString(c.formatted_name) ?? asString(c.name) ?? null,
        first_name: asString(name.first_name) ?? null,
        last_name: asString(name.last_name) ?? null,
      },
      phones: Array.isArray(c.phones)
        ? c.phones.map((p) => {
            const r = asRecord(p);
            return {
              phone: asString(r.phone) ?? asString(r.number) ?? null,
              type: asString(r.type) ?? null,
              wa_id: asString(r.wa_id) ?? null,
            };
          })
        : null,
      emails: Array.isArray(c.emails)
        ? c.emails.map((e) => {
            const r = asRecord(e);
            return { email: asString(r.email) ?? null, type: asString(r.type) ?? null };
          })
        : null,
      org: Object.keys(asRecord(c.org)).length
        ? {
            company: asString(asRecord(c.org).company) ?? null,
            title: asString(asRecord(c.org).title) ?? null,
          }
        : null,
      addresses: Array.isArray(c.addresses) ? (c.addresses as Array<Record<string, unknown>>) : null,
      urls: Array.isArray(c.urls)
        ? c.urls.map((u) => {
            const r = asRecord(u);
            return { url: asString(r.url) ?? null, type: asString(r.type) ?? null };
          })
        : null,
    };
  });
}

function normaliseButtons(value: unknown): WhatsAppButton[] | null {
  if (!value) return null;

  // Laravel's interaction_message_data.buttons is a { key: label } map.
  if (!Array.isArray(value) && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const buttons = entries
      .map(([key, label]): WhatsAppButton | null => {
        const rec = asRecord(label);
        const text =
          asString(label) ?? asString(rec.text) ?? asString(rec.title) ?? asString(key) ?? '';
        return text ? { type: 'reply', text } : null;
      })
      .filter((b): b is WhatsAppButton => b !== null);
    return buttons.length ? buttons : null;
  }

  if (!Array.isArray(value)) return null;

  const buttons = value
    .map((entry): WhatsAppButton | null => {
      if (typeof entry === 'string') return { type: 'reply', text: entry };
      const r = asRecord(entry);
      // Meta nests reply buttons: { type:'reply', reply:{ id, title } }
      const reply = asRecord(r.reply);
      const text =
        asString(r.text) ??
        asString(r.title) ??
        asString(reply.title) ??
        asString(r.label) ??
        null;
      if (!text) return null;
      return {
        type: asString(r.type) ?? 'reply',
        text,
        url: asString(r.url) ?? null,
        phone_number: asString(r.phone_number) ?? null,
        selected: r.selected === true,
      };
    })
    .filter((b): b is WhatsAppButton => b !== null);

  return buttons.length ? buttons : null;
}

function normaliseSections(value: unknown): WhatsAppListSection[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const sections = value
    .map((entry) => {
      const s = asRecord(entry);
      const rows = Array.isArray(s.rows)
        ? s.rows
            .map((row): WhatsAppListRow | null => {
              const r = asRecord(row);
              const title = asString(r.title) ?? asString(r.text) ?? null;
              if (!title) return null;
              return {
                id: asString(r.id) ?? null,
                title,
                description: asString(r.description) ?? null,
              };
            })
            .filter((r): r is WhatsAppListRow => r !== null)
        : [];
      return { title: asString(s.title) ?? null, rows };
    })
    .filter((s) => s.rows.length > 0 || s.title);
  return sections.length ? sections : null;
}

function normaliseInteractive(raw: Record<string, unknown>): WhatsAppInteractive | null {
  const contract = asRecord(raw.interactive);
  // Laravel's inbox payload uses `interaction_message_data`.
  const legacy = asRecord(raw.interaction_message_data);
  const source = Object.keys(contract).length > 0 ? contract : legacy;
  if (Object.keys(source).length === 0) return null;

  const headerRec = asRecord(source.header);
  const bodyRec = asRecord(source.body);
  const footerRec = asRecord(source.footer);
  const actionRec = asRecord(source.action);

  const body =
    asString(source.body) ??
    asString(bodyRec.text) ??
    asString(source.body_text) ??
    null;
  const footer =
    asString(source.footer) ??
    asString(footerRec.text) ??
    asString(source.footer_text) ??
    null;
  const headerText =
    asString(source.header) ??
    asString(headerRec.text) ??
    asString(source.header_text) ??
    null;

  const buttons =
    normaliseButtons(source.buttons) ??
    normaliseButtons(actionRec.buttons) ??
    null;
  const sections = normaliseSections(source.sections) ?? normaliseSections(actionRec.sections);

  const replyRec = Object.keys(asRecord(source.reply)).length
    ? asRecord(source.reply)
    : Object.keys(asRecord(source.button_reply)).length
      ? asRecord(source.button_reply)
      : asRecord(source.list_reply);

  const reply = Object.keys(replyRec).length
    ? {
        id: asString(replyRec.id) ?? null,
        title: asString(replyRec.title) ?? null,
        description: asString(replyRec.description) ?? null,
      }
    : null;

  const type =
    asString(source.type) ??
    asString(source.interactive_type) ??
    (sections ? 'list' : buttons ? 'button' : null);

  // Nothing displayable at all → treat as absent so the caller can fall back.
  if (!type && !body && !footer && !headerText && !buttons && !sections && !reply) return null;

  return {
    type,
    header: headerText ? { type: 'text', text: headerText, media: null } : null,
    body,
    footer,
    buttons,
    button_text: asString(source.button_text) ?? asString(actionRec.button) ?? null,
    sections,
    reply,
  };
}

function normaliseTemplate(raw: Record<string, unknown>): WhatsAppTemplatePayload | null {
  const contract = asRecord(raw.template);
  const proforma = asRecord(raw.template_proforma);
  const source = Object.keys(contract).length > 0 ? contract : proforma;

  const components =
    (Array.isArray(source.components) ? source.components : null) ??
    (Array.isArray(raw.template_components) ? raw.template_components : null);

  const name =
    asString(source.name) ??
    asString(raw.template_name) ??
    asString(asRecord(raw.metadata).template_name);

  const componentValues =
    (Array.isArray(source.component_values) ? source.component_values : null) ??
    (Array.isArray(raw.template_component_values) ? raw.template_component_values : null);

  if (!components && !name && !componentValues) return null;

  return {
    name: name ?? null,
    components: (components as WhatsAppTemplateComponent[] | null) ?? null,
    component_values: componentValues ?? null,
    language: asString(source.language) ?? null,
  };
}

/**
 * Decide the rendered type.
 *
 * Priority: an explicit, KNOWN type from the backend wins. Otherwise we infer
 * from the payload that is actually present, so a legacy row without a `type`
 * still renders as something. A recognised-but-unknown type string is preserved
 * on `raw_type` and rendered as 'unsupported'.
 */
function normaliseType(
  raw: Record<string, unknown>,
  parts: {
    media: WhatsAppMedia | null;
    location: WhatsAppLocation | null;
    contacts: WhatsAppContactCard[] | null;
    interactive: WhatsAppInteractive | null;
    template: WhatsAppTemplatePayload | null;
    text: string | null;
  },
): { type: WhatsAppMessageType; rawType: string | null } {
  const declared = (asString(raw.type) ?? asString(raw.message_type))?.toLowerCase() ?? null;

  if (declared) {
    if (KNOWN_TYPES.has(declared)) {
      return { type: declared as WhatsAppMessageType, rawType: declared };
    }
    // Common Meta aliases we can map safely.
    if (declared === 'voice' || declared === 'ptt') return { type: 'audio', rawType: declared };
    if (declared === 'contact') return { type: 'contacts', rawType: declared };
    if (declared === 'list' || declared === 'button_reply' || declared === 'list_reply') {
      return { type: 'interactive', rawType: declared };
    }
    // Genuinely unknown (reaction, order, system, ephemeral, …).
    return { type: 'unsupported', rawType: declared };
  }

  // No declared type — infer from content.
  if (parts.template) return { type: 'template', rawType: null };
  if (parts.interactive) return { type: 'interactive', rawType: null };
  if (parts.location) return { type: 'location', rawType: null };
  if (parts.contacts) return { type: 'contacts', rawType: null };
  if (parts.media) {
    const mime = (parts.media.mime ?? '').toLowerCase();
    if (mime.startsWith('image/')) return { type: 'image', rawType: null };
    if (mime.startsWith('video/')) return { type: 'video', rawType: null };
    if (mime.startsWith('audio/')) return { type: 'audio', rawType: null };
    if (mime === 'image' || mime === 'video' || mime === 'audio' || mime === 'document' || mime === 'sticker') {
      return { type: mime as WhatsAppMessageType, rawType: null };
    }
    return { type: 'document', rawType: null };
  }
  if (parts.text !== null) return { type: 'text', rawType: null };
  return { type: 'unsupported', rawType: null };
}

let synthCounter = 0;

/**
 * Turn any backend/realtime message row into the normalised envelope.
 *
 * Total function: never throws, never returns null, always renderable.
 */
export function normaliseWhatsAppMessage(input: unknown): WhatsAppMessage {
  const raw = asRecord(input);

  const text =
    asString(raw.text) ??
    asString(raw.message) ??
    asString(raw.body) ??
    asString(asRecord(raw.text).body) ??
    null;

  const media = normaliseMedia(raw);
  const location = normaliseLocation(raw);
  const contacts = normaliseContacts(raw);
  const interactive = normaliseInteractive(raw);
  const template = normaliseTemplate(raw);

  const { type, rawType } = normaliseType(raw, {
    media,
    location,
    contacts,
    interactive,
    template,
    text,
  });

  const wamid =
    asString(raw.wamid) ??
    asString(raw.wa_message_id) ??
    asString(raw.whatsapp_message_id) ??
    asString(asRecord(raw.meta).wamid) ??
    null;

  const clientId = asString(raw.client_id) ?? null;

  const id =
    asString(raw.id) ??
    asString(raw._uid) ??
    asString(raw.uid) ??
    wamid ??
    clientId ??
    `wa-local-${++synthCounter}`;

  const direction = normaliseDirection(raw);

  return {
    id,
    wamid,
    direction,
    type,
    // Inbound rows carry no meaningful delivery status — do not render ticks.
    status: direction === 'out' ? normaliseStatus(raw.status) : null,
    timestamp: normaliseTimestamp(
      raw.timestamp ?? raw.messaged_at ?? raw.created_at ?? raw.time ?? null,
    ),
    text,
    media,
    location,
    contacts,
    interactive,
    template,
    reply_to:
      asString(raw.reply_to) ??
      asString(raw.replied_to_wamid) ??
      asString(raw.replied_to_whatsapp_message_logs__uid) ??
      null,
    error:
      asString(raw.error) ??
      asString(raw.error_message) ??
      asString(raw.whatsapp_message_error) ??
      null,
    client_id: clientId,
    pending: raw.pending === true,
    raw_type: rawType,
  };
}

/** Normalise a list, dropping nothing. */
export function normaliseWhatsAppMessages(input: unknown): WhatsAppMessage[] {
  if (!Array.isArray(input)) return [];
  return input.map(normaliseWhatsAppMessage);
}

/**
 * Merge freshly-arrived messages into an existing list WITHOUT creating
 * duplicate rows.
 *
 * This is the reconciliation rule for realtime: an optimistic local echo and
 * the Pusher broadcast of the very same message MUST collapse into one row.
 *
 * Identity, in priority order:
 *   1. `wamid`      — authoritative once Meta has assigned one
 *   2. `client_id`  — links a server row back to the optimistic echo that made it
 *   3. `id`         — last resort for rows that have neither
 *
 * The incoming row wins on conflict (it is newer/more authoritative), except
 * that a confirmed row never regresses to `pending`.
 */
export function mergeWhatsAppMessages(
  existing: WhatsAppMessage[],
  incoming: WhatsAppMessage[],
): WhatsAppMessage[] {
  if (incoming.length === 0) return existing;

  const result = [...existing];
  // Map every identity a row answers to → its index in `result`.
  const index = new Map<string, number>();

  const keysFor = (m: WhatsAppMessage): string[] => {
    const keys: string[] = [];
    if (m.wamid) keys.push(`wamid:${m.wamid}`);
    if (m.client_id) keys.push(`cid:${m.client_id}`);
    if (m.id) keys.push(`id:${m.id}`);
    return keys;
  };

  result.forEach((m, i) => {
    keysFor(m).forEach((k) => {
      if (!index.has(k)) index.set(k, i);
    });
  });

  for (const next of incoming) {
    const keys = keysFor(next);
    let at = -1;
    for (const k of keys) {
      const found = index.get(k);
      if (found !== undefined) {
        at = found;
        break;
      }
    }

    if (at >= 0) {
      const prev = result[at];
      result[at] = {
        ...prev,
        ...next,
        // Keep the optimistic row's client_id so a later broadcast still matches.
        client_id: next.client_id ?? prev.client_id ?? null,
        // Never lose a wamid we already learned.
        wamid: next.wamid ?? prev.wamid ?? null,
        // A confirmed row must not fall back to "pending".
        pending: next.pending === true && prev.pending !== false ? true : false,
      };
      // The merged row may now answer to MORE identities (e.g. it just gained a
      // wamid) — register them so a subsequent duplicate also collapses here.
      keysFor(result[at]).forEach((k) => {
        if (!index.has(k)) index.set(k, at);
      });
    } else {
      result.push(next);
      keys.forEach((k) => {
        if (!index.has(k)) index.set(k, result.length - 1);
      });
    }
  }

  return sortWhatsAppMessages(result);
}

/** Chronological, newest last — the order the transcript renders in. */
export function sortWhatsAppMessages(messages: WhatsAppMessage[]): WhatsAppMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}
