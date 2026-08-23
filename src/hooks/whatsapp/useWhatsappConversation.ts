// src/hooks/whatsapp/useWhatsappConversation.ts
//
// One conversation: history, pagination, optimistic send, realtime reconciliation.
//
// The two things this hook exists to get right:
//
//   1. NO DUPLICATE ROWS. A send produces up to three sightings of the same
//      message — the optimistic echo, the send response, and the Pusher
//      broadcast. They collapse into one row via `mergeWhatsAppMessages`
//      (wamid → client_id → id).
//
//   2. HONEST FAILURE. An optimistic row that the server rejects is rolled back
//      to `failed` with the reason and a retry, not silently dropped and not
//      left looking sent.
//
// Pagination runs BACKWARDS: `nextCursor` fetches OLDER messages, which are
// PREPENDED. Appending them would scramble the transcript.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  whatsappChatService,
  isWhatsappEndpointUnavailable,
  WhatsAppApiError,
  type ConversationWindow,
} from '@/services/whatsappChatService';
import {
  subscribeToWhatsappRealtime,
  type RealtimeConnectionState,
  type RealtimeSubscription,
} from '@/services/whatsappRealtimeService';
import {
  mergeWhatsAppMessages,
  normaliseWhatsAppMessage,
  sortWhatsAppMessages,
  type WhatsAppMessage,
  type WhatsAppTemplateComponent,
} from '@/types/whatsapp/message';

export interface UseWhatsappConversationResult {
  messages: WhatsAppMessage[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  /** True when the chat endpoints are not deployed yet — degrade, don't error. */
  unavailable: boolean;
  error: string | null;
  window: ConversationWindow;
  connection: RealtimeConnectionState;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  sendText: (text: string) => Promise<boolean>;
  sendTemplate: (params: {
    template_uid?: string;
    template_name?: string;
    language?: string;
    components?: WhatsAppTemplateComponent[];
  }) => Promise<boolean>;
  /** Re-send a failed message. Removes the failed row and sends afresh. */
  retry: (message: WhatsAppMessage) => Promise<boolean>;
}

const EMPTY_WINDOW: ConversationWindow = {
  open: null,
  expiresAt: null,
  requiresTemplate: null,
  expiresHuman: null,
};

let clientIdCounter = 0;
/** Client-side correlation id for an optimistic row. */
const nextClientId = (): string =>
  `c-${Date.now().toString(36)}-${(++clientIdCounter).toString(36)}`;

export function useWhatsappConversation(
  contact: string | null | undefined,
): UseWhatsappConversationResult {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowState, setWindowState] = useState<ConversationWindow>(EMPTY_WINDOW);
  const [connection, setConnection] = useState<RealtimeConnectionState>('idle');

  // The conversation currently displayed. Guards every async completion so a
  // slow response for a previous contact cannot land in the new transcript.
  const activeContact = useRef<string | null>(null);
  const subscription = useRef<RealtimeSubscription | null>(null);

  // ── History ────────────────────────────────────────────────────────────────

  const load = useCallback(async (target: string) => {
    setIsLoading(true);
    setError(null);
    setUnavailable(false);
    try {
      const page = await whatsappChatService.getChatHistory({ contact: target });
      if (activeContact.current !== target) return;
      setMessages(page.messages);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setWindowState(page.window);
    } catch (e) {
      if (activeContact.current !== target) return;
      if (isWhatsappEndpointUnavailable(e)) {
        // Backend not deployed yet: show the empty-but-calm state.
        setUnavailable(true);
        setMessages([]);
      } else {
        setError(e instanceof WhatsAppApiError ? e.message : 'Could not load this conversation');
      }
    } finally {
      if (activeContact.current === target) setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    const target = activeContact.current;
    if (!target || !cursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const page = await whatsappChatService.getChatHistory({ contact: target, cursor });
      if (activeContact.current !== target) return;
      // OLDER messages: merge (which sorts chronologically) rather than append.
      setMessages((prev) => mergeWhatsAppMessages(prev, page.messages));
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (e) {
      if (activeContact.current !== target) return;
      if (!isWhatsappEndpointUnavailable(e)) {
        setError(e instanceof WhatsAppApiError ? e.message : 'Could not load earlier messages');
      }
      setHasMore(false);
    } finally {
      if (activeContact.current === target) setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore]);

  const refresh = useCallback(async () => {
    const target = activeContact.current;
    if (target) await load(target);
  }, [load]);

  useEffect(() => {
    const target = contact ?? null;
    activeContact.current = target;

    // Reset for the new conversation so the previous transcript never flashes.
    setMessages([]);
    setCursor(null);
    setHasMore(false);
    setError(null);
    setUnavailable(false);
    setWindowState(EMPTY_WINDOW);

    if (!target) {
      setIsLoading(false);
      return;
    }
    void load(target);
  }, [contact, load]);

  // ── Realtime ───────────────────────────────────────────────────────────────

  useEffect(() => {
    subscription.current = subscribeToWhatsappRealtime({
      onStateChange: setConnection,

      onMessage: ({ message, contact: eventContact }) => {
        const target = activeContact.current;
        if (!target) return;
        // The channel is tenant-wide; ignore other conversations.
        if (eventContact && !sameContact(eventContact, target)) return;

        // THE dedupe. An echo and its broadcast collapse into one row.
        setMessages((prev) => mergeWhatsAppMessages(prev, [message]));
      },

      onStatus: ({ wamid, id, status, error: statusError }) => {
        if (!wamid && !id) return;
        setMessages((prev) =>
          prev.map((m) => {
            const matches = (wamid && m.wamid === wamid) || (id && m.id === id);
            if (!matches) return m;
            return {
              ...m,
              status,
              error: statusError ?? m.error,
              pending: status === 'pending',
            };
          }),
        );
      },
    });

    return () => {
      subscription.current?.stop();
      subscription.current = null;
    };
  }, []);

  // ── Sending ────────────────────────────────────────────────────────────────

  /**
   * Optimistic send.
   *
   * Adds a local `pending` row immediately, then reconciles it with whatever the
   * server returns. On failure the SAME row is flipped to `failed` (with the
   * reason) rather than vanishing — a message the user typed must never
   * disappear silently.
   */
  const optimisticSend = useCallback(
    async (
      draft: Omit<Parameters<typeof normaliseWhatsAppMessage>[0] & object, never>,
      send: (clientId: string) => Promise<{ message: WhatsAppMessage | null; wamid: string | null }>,
    ): Promise<boolean> => {
      const target = activeContact.current;
      if (!target) return false;

      const clientId = nextClientId();
      const echo = normaliseWhatsAppMessage({
        ...(draft as Record<string, unknown>),
        id: clientId,
        client_id: clientId,
        direction: 'out',
        status: 'pending',
        pending: true,
        timestamp: new Date().toISOString(),
      });

      setMessages((prev) => sortWhatsAppMessages([...prev, echo]));

      try {
        const result = await send(clientId);

        setMessages((prev) => {
          if (result.message) {
            // Stamp OUR client id onto the confirmation before merging.
            //
            // Without this the collapse depends on the backend echoing
            // `client_id` back. When it does not — and it is not obliged to —
            // the confirmed row shares no identity with the optimistic echo
            // (different id, echo has no wamid yet) and the user sees their
            // message twice. We know the correlation locally; assert it.
            const confirmed = {
              ...result.message,
              client_id: result.message.client_id ?? clientId,
            };
            // Merge collapses the echo and the confirmation into one row.
            return mergeWhatsAppMessages(prev, [confirmed]);
          }
          // No body came back — promote the echo in place using the wamid.
          return prev.map((m) =>
            m.client_id === clientId
              ? { ...m, wamid: result.wamid ?? m.wamid, status: 'sent' as const, pending: false }
              : m,
          );
        });
        return true;
      } catch (e) {
        const reason =
          e instanceof WhatsAppApiError
            ? e.message
            : isWhatsappEndpointUnavailable(e)
              ? 'Sending is not available yet'
              : 'Message could not be sent';

        // ROLLBACK: keep the row, mark it failed, attach the reason.
        setMessages((prev) =>
          prev.map((m) =>
            m.client_id === clientId
              ? { ...m, status: 'failed' as const, pending: false, error: reason }
              : m,
          ),
        );
        return false;
      }
    },
    [],
  );

  const sendText = useCallback(
    async (text: string): Promise<boolean> => {
      const target = activeContact.current;
      const body = text.trim();
      if (!target || !body) return false;

      return optimisticSend({ type: 'text', text: body }, (clientId) =>
        whatsappChatService.sendText({ contact: target, text: body, client_id: clientId }),
      );
    },
    [optimisticSend],
  );

  const sendTemplate = useCallback(
    async (params: {
      template_uid?: string;
      template_name?: string;
      language?: string;
      components?: WhatsAppTemplateComponent[];
    }): Promise<boolean> => {
      const target = activeContact.current;
      if (!target) return false;

      return optimisticSend(
        {
          type: 'template',
          template: {
            name: params.template_name ?? null,
            components: params.components ?? null,
            language: params.language ?? null,
          },
        },
        (clientId) =>
          whatsappChatService.sendTemplate({ contact: target, ...params, client_id: clientId }),
      );
    },
    [optimisticSend],
  );

  const retry = useCallback(
    async (message: WhatsAppMessage): Promise<boolean> => {
      // Drop the failed row first so the retry does not sit beneath its own
      // corpse; the fresh optimistic row takes its place.
      setMessages((prev) => prev.filter((m) => m.id !== message.id));

      if (message.type === 'template' && message.template) {
        return sendTemplate({
          template_name: message.template.name ?? undefined,
          language: message.template.language ?? undefined,
          components: message.template.components ?? undefined,
        });
      }
      return sendText(message.text ?? '');
    },
    [sendText, sendTemplate],
  );

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    unavailable,
    error,
    window: windowState,
    connection,
    loadMore,
    refresh,
    sendText,
    sendTemplate,
    retry,
  };
}

/** Compare wa_ids tolerantly — one side may carry a '+' or spacing. */
function sameContact(a: string, b: string): boolean {
  const digits = (s: string) => s.replace(/\D/g, '');
  return a === b || digits(a) === digits(b);
}
