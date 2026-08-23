// src/hooks/whatsapp/__tests__/useWhatsappConversation.test.tsx
//
// The two behaviours that make or break a chat UI:
//   * an optimistic send that ROLLS BACK visibly instead of lying or vanishing
//   * an echo and its realtime broadcast collapsing into ONE row

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getChatHistory = vi.fn();
const sendText = vi.fn();
const sendTemplate = vi.fn();

vi.mock('@/services/whatsappChatService', async () => {
  const actual = await vi.importActual<typeof import('@/services/whatsappChatService')>(
    '@/services/whatsappChatService',
  );
  return {
    ...actual,
    whatsappChatService: {
      getChatHistory: (...args: unknown[]) => getChatHistory(...args),
      sendText: (...args: unknown[]) => sendText(...args),
      sendTemplate: (...args: unknown[]) => sendTemplate(...args),
      getRealtimeGrant: vi.fn(),
      getConversations: vi.fn(),
      fetchMediaObjectUrl: vi.fn(),
    },
  };
});

// Capture the realtime handlers so tests can fire broadcasts by hand.
let realtimeHandlers: {
  onMessage?: (e: { message: unknown; contact: string | null }) => void;
  onStatus?: (e: unknown) => void;
  onStateChange?: (s: string) => void;
} = {};

vi.mock('@/services/whatsappRealtimeService', () => ({
  subscribeToWhatsappRealtime: (handlers: typeof realtimeHandlers) => {
    realtimeHandlers = handlers;
    return { stop: vi.fn(), getState: () => 'connected' };
  },
}));

import { useWhatsappConversation } from '@/hooks/whatsapp/useWhatsappConversation';
import { normaliseWhatsAppMessage } from '@/types/whatsapp/message';
import { WhatsAppApiError } from '@/services/whatsappChatService';

const CONTACT = '911234567890';

const emptyHistory = {
  messages: [],
  nextCursor: null,
  hasMore: false,
  window: { open: true, expiresAt: null, requiresTemplate: false, expiresHuman: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  realtimeHandlers = {};
  getChatHistory.mockResolvedValue(emptyHistory);
});

const mountHook = async () => {
  const view = renderHook(() => useWhatsappConversation(CONTACT));
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
};

describe('optimistic send', () => {
  it('shows the message immediately as pending, then confirms it in place', async () => {
    let resolveSend: (v: unknown) => void = () => {};
    sendText.mockReturnValueOnce(new Promise((r) => { resolveSend = r; }));

    const { result } = await mountHook();

    // Fire the send but do NOT await — we want the intermediate state.
    let sendPromise: Promise<boolean>;
    act(() => {
      sendPromise = result.current.sendText('hello there');
    });

    // The row appears at once, marked pending.
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].text).toBe('hello there');
    expect(result.current.messages[0].status).toBe('pending');
    expect(result.current.messages[0].pending).toBe(true);
    expect(result.current.messages[0].direction).toBe('out');

    const clientId = result.current.messages[0].client_id!;
    expect(clientId).toBeTruthy();

    // Server confirms, echoing the client id back.
    await act(async () => {
      resolveSend({
        message: normaliseWhatsAppMessage({
          id: 'srv-1',
          wamid: 'wamid.OK',
          client_id: clientId,
          direction: 'out',
          type: 'text',
          text: 'hello there',
          status: 'sent',
        }),
        wamid: 'wamid.OK',
      });
      await sendPromise!;
    });

    // STILL one row — confirmed in place, not duplicated.
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].status).toBe('sent');
    expect(result.current.messages[0].wamid).toBe('wamid.OK');
    expect(result.current.messages[0].pending).toBe(false);
  });

  it('ROLLS BACK to failed, keeping the message and the reason', async () => {
    sendText.mockRejectedValueOnce(
      new WhatsAppApiError({
        isAxiosError: true,
        response: { status: 422, data: { error: 'Outside the 24-hour window' } },
      }),
    );

    const { result } = await mountHook();

    let ok = true;
    await act(async () => {
      ok = await result.current.sendText('this will fail');
    });

    expect(ok).toBe(false);
    // The message the user typed must NOT disappear.
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('this will fail');
    expect(result.current.messages[0].status).toBe('failed');
    expect(result.current.messages[0].pending).toBe(false);
    expect(result.current.messages[0].error).toBe('Outside the 24-hour window');
  });

  it('reports a not-yet-deployed backend without pretending the send worked', async () => {
    sendText.mockRejectedValueOnce(
      new WhatsAppApiError({ isAxiosError: true, response: { status: 404, data: {} } }),
    );

    const { result } = await mountHook();
    await act(async () => {
      await result.current.sendText('hi');
    });

    expect(result.current.messages[0].status).toBe('failed');
    expect(result.current.messages[0].error).toBeTruthy();
  });

  it('retry removes the failed row and sends afresh', async () => {
    sendText.mockRejectedValueOnce(
      new WhatsAppApiError({ isAxiosError: true, response: { status: 500, data: {} } }),
    );

    const { result } = await mountHook();
    await act(async () => {
      await result.current.sendText('retry me');
    });
    expect(result.current.messages).toHaveLength(1);
    const failed = result.current.messages[0];

    sendText.mockResolvedValueOnce({
      message: normaliseWhatsAppMessage({
        id: 'srv-2',
        wamid: 'wamid.RETRY',
        direction: 'out',
        type: 'text',
        text: 'retry me',
        status: 'sent',
      }),
      wamid: 'wamid.RETRY',
    });

    await act(async () => {
      await result.current.retry(failed);
    });

    // One row, now succeeded — not the corpse plus a new attempt.
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].status).toBe('sent');
  });

  it('refuses to send empty or whitespace-only text', async () => {
    const { result } = await mountHook();
    await act(async () => {
      await result.current.sendText('   ');
    });
    expect(sendText).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });
});

describe('realtime reconciliation', () => {
  it('does NOT duplicate when the echo and the broadcast collide on wamid', async () => {
    sendText.mockResolvedValueOnce({
      message: normaliseWhatsAppMessage({
        id: 'srv-1',
        wamid: 'wamid.SAME',
        direction: 'out',
        type: 'text',
        text: 'only once',
        status: 'sent',
      }),
      wamid: 'wamid.SAME',
    });

    const { result } = await mountHook();
    await act(async () => {
      await result.current.sendText('only once');
    });
    expect(result.current.messages).toHaveLength(1);

    // The Pusher broadcast for the SAME message arrives moments later.
    act(() => {
      realtimeHandlers.onMessage?.({
        message: normaliseWhatsAppMessage({
          id: 'broadcast-row',
          wamid: 'wamid.SAME',
          direction: 'out',
          type: 'text',
          text: 'only once',
          status: 'delivered',
        }),
        contact: CONTACT,
      });
    });

    // Still ONE row — and it took the newer status.
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].status).toBe('delivered');
  });

  it('ignores broadcasts for a different conversation', async () => {
    const { result } = await mountHook();

    act(() => {
      realtimeHandlers.onMessage?.({
        message: normaliseWhatsAppMessage({
          id: 'other',
          wamid: 'wamid.OTHER',
          type: 'text',
          text: 'not for you',
          direction: 'in',
        }),
        contact: '919999999999',
      });
    });

    expect(result.current.messages).toHaveLength(0);
  });

  it('accepts an inbound broadcast for this conversation', async () => {
    const { result } = await mountHook();

    act(() => {
      realtimeHandlers.onMessage?.({
        message: normaliseWhatsAppMessage({
          id: 'in-1',
          wamid: 'wamid.IN',
          type: 'text',
          text: 'hello!',
          direction: 'in',
        }),
        // The backend may format the wa_id with a '+'; matching is tolerant.
        contact: `+${CONTACT}`,
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('hello!');
  });

  it('applies a status-only broadcast to the matching row', async () => {
    getChatHistory.mockResolvedValue({
      ...emptyHistory,
      messages: [
        normaliseWhatsAppMessage({
          id: 'm1',
          wamid: 'wamid.A',
          direction: 'out',
          type: 'text',
          text: 'hi',
          status: 'sent',
        }),
      ],
    });

    const { result } = await mountHook();
    expect(result.current.messages[0].status).toBe('sent');

    act(() => {
      realtimeHandlers.onStatus?.({ wamid: 'wamid.A', id: null, status: 'read', error: null });
    });

    expect(result.current.messages[0].status).toBe('read');
  });
});

describe('history', () => {
  it('degrades quietly when the chat endpoint is not deployed yet', async () => {
    getChatHistory.mockRejectedValueOnce(
      new WhatsAppApiError({ isAxiosError: true, response: { status: 404, data: {} } }),
    );

    const { result } = await mountHook();

    expect(result.current.unavailable).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  it('surfaces a real failure as an error, not as "unavailable"', async () => {
    getChatHistory.mockRejectedValueOnce(
      new WhatsAppApiError({ isAxiosError: true, response: { status: 500, data: {} } }),
    );

    const { result } = await mountHook();

    expect(result.current.unavailable).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('exposes the backend 24-hour window state', async () => {
    getChatHistory.mockResolvedValue({
      ...emptyHistory,
      window: {
        open: false,
        expiresAt: '2026-08-21T10:00:00Z',
        requiresTemplate: true,
        expiresHuman: 'closed 2 hours ago',
      },
    });

    const { result } = await mountHook();

    expect(result.current.window.open).toBe(false);
    expect(result.current.window.requiresTemplate).toBe(true);
  });

  it('PREPENDS older pages rather than appending them', async () => {
    getChatHistory.mockResolvedValueOnce({
      ...emptyHistory,
      messages: [
        normaliseWhatsAppMessage({
          id: 'new',
          wamid: 'w-new',
          type: 'text',
          text: 'newer',
          direction: 'in',
          timestamp: '2026-08-20T12:00:00Z',
        }),
      ],
      nextCursor: 'p2',
      hasMore: true,
    });

    const { result } = await mountHook();
    expect(result.current.messages.map((m) => m.text)).toEqual(['newer']);

    getChatHistory.mockResolvedValueOnce({
      ...emptyHistory,
      messages: [
        normaliseWhatsAppMessage({
          id: 'old',
          wamid: 'w-old',
          type: 'text',
          text: 'older',
          direction: 'in',
          timestamp: '2026-08-20T09:00:00Z',
        }),
      ],
      nextCursor: null,
      hasMore: false,
    });

    await act(async () => {
      await result.current.loadMore();
    });

    // Chronological: the older page lands FIRST, not at the bottom.
    expect(result.current.messages.map((m) => m.text)).toEqual(['older', 'newer']);
    expect(result.current.hasMore).toBe(false);
  });
});
