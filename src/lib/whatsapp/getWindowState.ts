// src/lib/whatsapp/getWindowState.ts
//
// SHARED WhatsApp 24-hour session-window state — single source of truth for
// both the Inbox and the CRM lead drawer.
//
// The backend now returns ONE normalised object:
//
//   reply_window: { open, expires_at, requires_template, expires_human }
//
// That is authoritative and is what we read. The flat aliases
// (`reply_window_open`, `window_expires_at`, `reply_window_expires_at`,
// `is_reply_window_open`) are still emitted for the currently-deployed frontend
// and are accepted as fallbacks — this key-name mismatch is precisely why the
// "closes in 3 hours" countdown used to render nothing: Laravel emitted
// `reply_window_expires_at` while the client read `window_expires_at`, so
// `expiresAt` was always null.
//
// The client-side last-inbound heuristic is kept ONLY as a last resort, for
// payloads that carry no window information at all. Invalid/missing timestamps
// are guarded (no RangeError).

/** The canonical object the backend now returns. */
export interface ReplyWindowPayload {
  open?: boolean;
  expires_at?: string | null;
  requires_template?: boolean;
  expires_human?: string | null;
}

export interface WindowChatInput {
  /** Canonical, preferred. */
  reply_window?: ReplyWindowPayload | null;
  /** Legacy flat aliases, accepted as fallbacks. */
  reply_window_open?: boolean;
  is_reply_window_open?: boolean;
  requires_template?: boolean;
  window_expires_at?: string | null;
  reply_window_expires_at?: string | null;
  expires_at?: string | null;
  reply_window_expires_human?: string | null;
  messages?: Array<{ direction?: string; timestamp?: string | null }>;
}

export interface WindowState {
  /** Whether free-form (non-template) messages are currently allowed. */
  windowOpen: boolean;
  /** When the 24h window closes, if known. */
  expiresAt: Date | null;
  /** Whether a template is required to message right now. */
  requiresTemplate: boolean;
  /** Backend-rendered "closes in 3 hours", when supplied. */
  expiresHuman?: string | null;
  /**
   * True when this came from the client-side last-inbound guess rather than the
   * backend. The UI can soften its copy accordingly.
   */
  isHeuristic?: boolean;
}

const DAY_MS = 24 * 3600 * 1000;

function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getWindowState(chat: WindowChatInput | null | undefined): WindowState {
  if (!chat) {
    return { windowOpen: false, expiresAt: null, requiresTemplate: true, isHeuristic: false };
  }

  // 1) THE canonical field. One object, one meaning, backend-authoritative.
  const rw = chat.reply_window;
  if (rw && typeof rw.open === 'boolean') {
    return {
      windowOpen: rw.open,
      expiresAt: safeDate(rw.expires_at ?? null),
      requiresTemplate:
        typeof rw.requires_template === 'boolean' ? rw.requires_template : !rw.open,
      expiresHuman: rw.expires_human ?? null,
      isHeuristic: false,
    };
  }

  // 2) Legacy flat aliases, still emitted for the deployed frontend.
  const flatOpen =
    typeof chat.reply_window_open === 'boolean'
      ? chat.reply_window_open
      : typeof chat.is_reply_window_open === 'boolean'
        ? chat.is_reply_window_open
        : null;

  if (flatOpen !== null) {
    return {
      windowOpen: flatOpen,
      expiresAt: safeDate(
        chat.window_expires_at ?? chat.reply_window_expires_at ?? chat.expires_at ?? null,
      ),
      requiresTemplate:
        typeof chat.requires_template === 'boolean' ? chat.requires_template : !flatOpen,
      expiresHuman: chat.reply_window_expires_human ?? null,
      isHeuristic: false,
    };
  }

  // 3) LAST RESORT: guess from the most recent INBOUND message (< 24h ago).
  //
  // Kept only for payloads with no window information at all. It is a guess: it
  // sees only the messages currently loaded, so a conversation whose last
  // inbound message is older than the loaded page reads as closed.
  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  const lastInbound = messages
    .filter((m) => isInbound(m.direction) && safeDate(m.timestamp))
    .sort((a, b) => safeDate(b.timestamp)!.getTime() - safeDate(a.timestamp)!.getTime())[0];

  const lastTs = lastInbound ? safeDate(lastInbound.timestamp) : null;
  const windowOpen = !!lastTs && lastTs.getTime() > Date.now() - DAY_MS;
  const expiresAt = windowOpen && lastTs ? new Date(lastTs.getTime() + DAY_MS) : null;

  return {
    windowOpen,
    expiresAt,
    requiresTemplate: !windowOpen,
    expiresHuman: null,
    isHeuristic: true,
  };
}

/** Inbound spellings vary by payload source ('in' | 'inbound' | 'incoming'). */
function isInbound(direction?: string): boolean {
  return direction === 'in' || direction === 'inbound' || direction === 'incoming';
}
