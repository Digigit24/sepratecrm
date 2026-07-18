// src/lib/whatsapp/getWindowState.ts
//
// SHARED WhatsApp 24-hour session-window state — single source of truth for
// both the Inbox and the CRM lead drawer.
//
// Prefers BACKEND-AUTHORITATIVE fields when the chat payload provides them
// (`reply_window_open` / `window_expires_at` / `requires_template`), and only
// falls back to the client-side last-inbound heuristic when they're absent.
// Invalid/missing timestamps are guarded (no RangeError).

export interface WindowChatInput {
  reply_window_open?: boolean;
  requires_template?: boolean;
  window_expires_at?: string | null;
  expires_at?: string | null;
  messages?: Array<{ direction?: string; timestamp?: string | null }>;
}

export interface WindowState {
  /** Whether free-form (non-template) messages are currently allowed. */
  windowOpen: boolean;
  /** When the 24h window closes, if known. */
  expiresAt: Date | null;
  /** Whether a template is required to message right now. */
  requiresTemplate: boolean;
}

const DAY_MS = 24 * 3600 * 1000;

function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getWindowState(chat: WindowChatInput | null | undefined): WindowState {
  if (!chat) return { windowOpen: false, expiresAt: null, requiresTemplate: true };

  // 1) Backend-authoritative fields (preferred).
  if (typeof chat.reply_window_open === 'boolean') {
    const expiresAt = safeDate(chat.window_expires_at ?? chat.expires_at ?? null);
    return {
      windowOpen: chat.reply_window_open,
      expiresAt,
      requiresTemplate:
        typeof chat.requires_template === 'boolean'
          ? chat.requires_template
          : !chat.reply_window_open,
    };
  }

  // 2) Fallback: derive from the most recent INBOUND message (< 24h ago).
  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  const lastInbound = messages
    .filter((m) => m.direction === 'inbound' && safeDate(m.timestamp))
    .sort((a, b) => safeDate(b.timestamp)!.getTime() - safeDate(a.timestamp)!.getTime())[0];

  const lastTs = lastInbound ? safeDate(lastInbound.timestamp) : null;
  const windowOpen = !!lastTs && lastTs.getTime() > Date.now() - DAY_MS;
  const expiresAt = windowOpen && lastTs ? new Date(lastTs.getTime() + DAY_MS) : null;

  return { windowOpen, expiresAt, requiresTemplate: !windowOpen };
}
