// src/hooks/whatsapp/__tests__/useRealtimeChat.test.tsx
//
// The point of this file is one assertion: a rich DigiCRM event renders with
// NO network call. Everything else here exists to prove that the fallbacks
// around it still work, because the failure mode of getting this wrong is
// silent — the chat still looks fine, it just costs a conversation GET per
// inbound message, which is exactly what it cost before.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Pusher: capture the callbacks instead of opening a socket ────────────────
let callbacks: Record<string, (data: unknown) => void> = {};
const unsubscribe = vi.fn();

vi.mock('@/services/pusherService', () => ({
  subscribeToVendorChannel: (_vendorUid: string, cbs: Record<string, (d: unknown) => void>) => {
    callbacks = cbs;
    return unsubscribe;
  },
  disconnectEcho: vi.fn(),
  getCurrentVendorUid: () => 'vendor-uid-1',
  getConnectionState: () => 'connected',
}));

// ── The two network calls we are asserting about ─────────────────────────────
const getContactMessages = vi.fn();
const getMessage = vi.fn();

vi.mock('@/services/whatsapp/chatService', () => ({
  chatService: {
    getContactMessages: (...args: unknown[]) => getContactMessages(...args),
    getMessage: (...args: unknown[]) => getMessage(...args),
  },
}));

import { useRealtimeChat } from '@/hooks/whatsapp/useRealtimeChat';
import { chatKeys } from '@/hooks/whatsapp/useChat';
import { __resetThinRefetchCoordination } from '@/lib/whatsapp/richRealtime';

const CONTACT = 'contact-uid-1';

const envelope = (over: Record<string, unknown> = {}) => ({
  id: 'msg-uid-1',
  wamid: 'wamid.AAA',
  direction: 'in',
  type: 'text',
  status: null,
  timestamp: '2026-08-24T10:30:00Z',
  text: 'hello there',
  media: null,
  location: null,
  contacts: null,
  interactive: null,
  template: null,
  reply_to: null,
  error: null,
  ...over,
});

const richEvent = (over: Record<string, unknown> = {}) => ({
  message: envelope(over),
  contact: '919876543210',
  contact_uid: CONTACT,
});

const thinEvent = () => ({
  contactUid: CONTACT,
  contactWaId: '919876543210',
  isNewIncomingMessage: true,
  lastMessageUid: 'msg-uid-1',
});

/**
 * Mount the hook over a seeded message cache.
 *
 * The thin-refetch coordination is module state by design - every mounted
 * consumer of the channel has to agree about whether a refetch is still needed
 * - so `__resetThinRefetchCoordination()` runs between tests rather than
 * `vi.resetModules()`, which re-imported the whole module graph 13 times and
 * ran the worker out of heap.
 */
function mount(seedMessages: Record<string, unknown>[] = []) {
  callbacks = {};

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(chatKeys.messages(CONTACT, {}), {
    messages: seedMessages,
    total: seedMessages.length,
    page: 1,
    limit: 50,
    contact: { _uid: CONTACT },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(
    () => useRealtimeChat({ enabled: true, selectedContactUid: CONTACT, playNotificationSound: false }),
    { wrapper },
  );

  const messages = () =>
    (queryClient.getQueryData(chatKeys.messages(CONTACT, {})) as { messages: Record<string, unknown>[] })
      ?.messages ?? [];

  return { view, queryClient, messages };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetThinRefetchCoordination();
  getContactMessages.mockResolvedValue({ messages: [], total: 0, page: 1, limit: 1, contact: {} });
  getMessage.mockResolvedValue({ _uid: 'msg-uid-1', wamid: 'wamid.AAA', message_body: 'fetched' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a rich DigicrmMessage renders without a network call', () => {
  it('writes the message straight into the cache and fetches NOTHING', async () => {
    const { messages } = mount();

    await act(async () => {
      callbacks.onDigicrmMessage?.(richEvent());
    });

    // THE assertion this whole change exists for.
    expect(getContactMessages).not.toHaveBeenCalled();
    expect(getMessage).not.toHaveBeenCalled();

    expect(messages()).toHaveLength(1);
    expect(messages()[0].wamid).toBe('wamid.AAA');
    expect(messages()[0].text).toBe('hello there');
  });

  it('carries the media block through, so a photo is not rendered as a blank bubble', async () => {
    const { messages } = mount();

    await act(async () => {
      callbacks.onDigicrmMessage?.(richEvent({
        type: 'image',
        media: { url: 'media/abc.jpg', mime: 'image/jpeg', caption: 'the roof' },
      }));
    });

    expect(getContactMessages).not.toHaveBeenCalled();
    expect(messages()[0].type).toBe('image');
    expect((messages()[0].media as { url: string }).url).toBe('media/abc.jpg');
  });

  it('ignores a payload with no renderable message rather than adding a blank row', async () => {
    const { messages } = mount();

    await act(async () => {
      callbacks.onDigicrmMessage?.({ contact: '919876543210', contact_uid: CONTACT });
    });

    expect(messages()).toHaveLength(0);
    expect(getContactMessages).not.toHaveBeenCalled();
  });
});

describe('the thin Laravel event still works as a fallback', () => {
  it('refetches immediately when no rich event has ever been seen', async () => {
    mount();

    await act(async () => {
      callbacks.onVendorBroadcast?.(thinEvent());
    });

    // Today's behaviour, unchanged, for a backend that does not publish rich
    // events: one conversation fetch.
    expect(getContactMessages).toHaveBeenCalledTimes(1);
    expect(getContactMessages).toHaveBeenCalledWith(CONTACT, { page: 1, limit: 50 });
  });

  it('stands down once a rich event for the same message arrives', async () => {
    vi.useFakeTimers();
    const { messages } = mount();

    // A rich event first, so the hook knows DigiCRM is publishing.
    await act(async () => {
      callbacks.onDigicrmMessage?.(richEvent());
    });
    getContactMessages.mockClear();

    // Now the pair arrives for a SECOND message: thin first, rich right after.
    act(() => {
      callbacks.onVendorBroadcast?.(thinEvent());
    });
    act(() => {
      callbacks.onDigicrmMessage?.(richEvent({ id: 'msg-uid-2', wamid: 'wamid.BBB', text: 'second' }));
    });

    // Let the grace window elapse. The deferred refetch must have been cancelled.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(getContactMessages).not.toHaveBeenCalled();
    expect(messages()).toHaveLength(2);
  });

  it('still refetches if the rich event never turns up', async () => {
    vi.useFakeTimers();
    mount();

    await act(async () => {
      callbacks.onDigicrmMessage?.(richEvent());
    });
    getContactMessages.mockClear();

    act(() => {
      callbacks.onVendorBroadcast?.(thinEvent());
    });
    expect(getContactMessages).not.toHaveBeenCalled(); // deferred, not dropped

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(getContactMessages).toHaveBeenCalledTimes(1);
  });
});

describe('payloads that cannot be trusted trigger ONE single-message fetch', () => {
  it('refetches exactly one message when the server truncated it', async () => {
    mount();

    await act(async () => {
      callbacks.onDigicrmMessage?.(richEvent({ truncated: true, text: 'x'.repeat(2000) }));
    });

    expect(getMessage).toHaveBeenCalledTimes(1);
    expect(getMessage).toHaveBeenCalledWith('msg-uid-1');
    // Never the conversation.
    expect(getContactMessages).not.toHaveBeenCalled();
  });

  it('refetches one message when n8n forwarded less than the type promises', async () => {
    mount();

    await act(async () => {
      // An image with no media block - the documented n8n fidelity gap.
      callbacks.onDigicrmMessage?.(richEvent({ type: 'image', media: null }));
    });

    expect(getMessage).toHaveBeenCalledTimes(1);
    expect(getContactMessages).not.toHaveBeenCalled();
  });

  it('falls back to the newest-message page when the envelope has no server id', async () => {
    mount();

    await act(async () => {
      callbacks.onDigicrmMessage?.(richEvent({ id: '', truncated: true }));
    });

    expect(getMessage).not.toHaveBeenCalled();
    // Still ONE message, not the conversation.
    expect(getContactMessages).toHaveBeenCalledWith(CONTACT, { page: 1, limit: 1 });
  });
});

describe('DigicrmMessageStatus updates ticks in place', () => {
  it('stamps the matching outbound row and fetches nothing', async () => {
    const { messages } = mount([
      { _uid: 'out-1', wamid: 'wamid.OUT', is_incoming_message: false, status: 'sent' },
      { _uid: 'out-2', wamid: 'wamid.OTHER', is_incoming_message: false, status: 'sent' },
    ]);

    await act(async () => {
      callbacks.onDigicrmMessageStatus?.({
        wamid: 'wamid.OUT', id: 'out-1', status: 'read', error: null,
        contact: '919876543210', contact_uid: CONTACT,
      });
    });

    expect(messages()[0].status).toBe('read');
    expect(messages()[1].status).toBe('sent');
    expect(getContactMessages).not.toHaveBeenCalled();
    expect(getMessage).not.toHaveBeenCalled();
  });

  it('never draws a tick on an inbound message', async () => {
    const { messages } = mount([
      { _uid: 'in-1', wamid: 'wamid.IN', is_incoming_message: true, status: undefined },
    ]);

    await act(async () => {
      callbacks.onDigicrmMessageStatus?.({
        wamid: 'wamid.IN', id: 'in-1', status: 'read', error: null,
        contact: '919876543210', contact_uid: CONTACT,
      });
    });

    expect(messages()[0].status).toBeUndefined();
  });

  it('carries a failure reason onto the row', async () => {
    const { messages } = mount([
      { _uid: 'out-1', wamid: 'wamid.OUT', is_incoming_message: false, status: 'sent' },
    ]);

    await act(async () => {
      callbacks.onDigicrmMessageStatus?.({
        wamid: 'wamid.OUT', id: null, status: 'failed',
        error: 'Recipient has not opted in',
        contact: '919876543210', contact_uid: CONTACT,
      });
    });

    expect(messages()[0].status).toBe('failed');
    expect(messages()[0].whatsapp_message_error).toBe('Recipient has not opted in');
  });
});

describe('dedupe across all three sightings', () => {
  it('an echo, a refetched server row and a rich event stay ONE row', async () => {
    const { messages } = mount([
      // 1. the optimistic echo, and 2. the server row it has already been
      //    reconciled with by the existing send path
      { _uid: 'server-1', id: 'server-1', client_id: 'cid-1', wamid: 'wamid.OUT1', status: 'sent' },
    ]);

    // 3. DigiCRM's rich event for that same message.
    await act(async () => {
      callbacks.onDigicrmMessage?.({
        message: envelope({
          id: 'server-1', wamid: 'wamid.OUT1', direction: 'out',
          status: 'delivered', text: 'hi',
        }),
        contact: '919876543210',
        contact_uid: CONTACT,
      });
    });

    expect(messages()).toHaveLength(1);
    expect(messages()[0].status).toBe('delivered');
    expect(messages()[0].client_id).toBe('cid-1');
  });
});
