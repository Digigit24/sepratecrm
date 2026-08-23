// src/services/__tests__/whatsappChatService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/client', () => ({
  crmClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authClient: { get: vi.fn() },
  tokenManager: {},
}));

import { crmClient } from '@/lib/client';
import {
  whatsappChatService,
  isWhatsappEndpointUnavailable,
  readConversationWindow,
  WhatsAppApiError,
  WHATSAPP_CHAT_PATHS,
} from '@/services/whatsappChatService';

const get = crmClient.get as ReturnType<typeof vi.fn>;
const post = crmClient.post as ReturnType<typeof vi.fn>;

const axiosError = (status: number, data: unknown = {}) => ({
  isAxiosError: true,
  response: { status, data },
  message: `Request failed with status code ${status}`,
});

beforeEach(() => vi.clearAllMocks());

describe('graceful degradation while the backend is still landing', () => {
  it.each([404, 501, 502, 503])('treats %i as "endpoint not deployed yet"', async (status) => {
    get.mockRejectedValueOnce(axiosError(status));
    const error = await whatsappChatService
      .getChatHistory({ contact: '911234567890' })
      .catch((e) => e);

    expect(error).toBeInstanceOf(WhatsAppApiError);
    expect(isWhatsappEndpointUnavailable(error)).toBe(true);
  });

  it.each([400, 401, 403, 422, 500])('does NOT swallow a real %i failure', async (status) => {
    get.mockRejectedValueOnce(axiosError(status, { error: 'nope' }));
    const error = await whatsappChatService
      .getChatHistory({ contact: '911234567890' })
      .catch((e) => e);

    expect(isWhatsappEndpointUnavailable(error)).toBe(false);
    expect((error as WhatsAppApiError).status).toBe(status);
  });

  it('surfaces the backend error message when there is one', async () => {
    post.mockRejectedValueOnce(axiosError(422, { error: 'Outside the 24-hour window' }));
    const error = await whatsappChatService
      .sendText({ contact: '911234567890', text: 'hi' })
      .catch((e) => e);
    expect((error as WhatsAppApiError).message).toBe('Outside the 24-hour window');
  });

  it('reports the realtime grant as unavailable on a 404', async () => {
    post.mockRejectedValueOnce(axiosError(404));
    const error = await whatsappChatService.getRealtimeGrant().catch((e) => e);
    expect(isWhatsappEndpointUnavailable(error)).toBe(true);
  });
});

describe('getRealtimeGrant', () => {
  it('takes the channel and event names VERBATIM from the response', async () => {
    post.mockResolvedValueOnce({
      data: {
        key: 'app-key',
        cluster: 'ap2',
        // Note the mandatory `private-` prefix — reconstructing this
        // client-side is exactly the bug this asserts against.
        channel: 'private-vendor-channel.abc-123',
        event: 'VendorChannelBroadcast',
        echo_event: '.VendorChannelBroadcast',
      },
    });

    const grant = await whatsappChatService.getRealtimeGrant();

    expect(grant.channel).toBe('private-vendor-channel.abc-123');
    expect(grant.event).toBe('VendorChannelBroadcast');
    expect(grant.echo_event).toBe('.VendorChannelBroadcast');
    expect(post).toHaveBeenCalledWith(WHATSAPP_CHAT_PATHS.REALTIME_GRANT, {}, expect.anything());
  });

  it('passes socket_id and channel_name through when acting as the authorizer', async () => {
    post.mockResolvedValueOnce({ data: { auth: 'app-key:signature' } });
    const grant = await whatsappChatService.getRealtimeGrant({
      socket_id: '123.456',
      channel_name: 'private-vendor-channel.abc-123',
    });

    expect(grant.auth).toBe('app-key:signature');
    expect(post).toHaveBeenCalledWith(
      WHATSAPP_CHAT_PATHS.REALTIME_GRANT,
      { socket_id: '123.456', channel_name: 'private-vendor-channel.abc-123' },
      expect.anything(),
    );
  });

  it('never returns or requests the vendor token', async () => {
    post.mockResolvedValueOnce({
      data: { key: 'k', cluster: 'c', channel: 'private-x', vendor_api_token: 'LEAK' },
    });
    const grant = await whatsappChatService.getRealtimeGrant();
    expect(JSON.stringify(grant)).not.toContain('LEAK');
  });
});

describe('getChatHistory', () => {
  it('normalises messages and reads the opaque backwards cursor', async () => {
    get.mockResolvedValueOnce({
      data: {
        messages: [
          { id: '1', wamid: 'w1', direction: 'in', type: 'text', text: 'hi', timestamp: '2026-08-20T10:00:00Z' },
          { id: '2', wamid: 'w2', direction: 'out', type: 'text', text: 'hello', status: 'read', timestamp: '2026-08-20T10:01:00Z' },
        ],
        next_cursor: 'p2',
        reply_window: { open: true, expires_at: '2026-08-21T10:00:00Z', requires_template: false },
      },
    });

    const page = await whatsappChatService.getChatHistory({ contact: '911234567890' });

    expect(page.messages).toHaveLength(2);
    expect(page.messages[0].text).toBe('hi');
    expect(page.nextCursor).toBe('p2');
    expect(page.hasMore).toBe(true);
    expect(page.window.open).toBe(true);
    expect(page.window.requiresTemplate).toBe(false);
  });

  it('reports no more history when the cursor runs out', async () => {
    get.mockResolvedValueOnce({ data: { messages: [], next_cursor: null } });
    const page = await whatsappChatService.getChatHistory({ contact: '911234567890' });
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('sends contact and cursor as query params', async () => {
    get.mockResolvedValueOnce({ data: { messages: [] } });
    await whatsappChatService.getChatHistory({ contact: '911234567890', cursor: 'p3' });
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('contact=911234567890'),
      expect.anything(),
    );
    expect(get).toHaveBeenCalledWith(expect.stringContaining('cursor=p3'), expect.anything());
  });

  it('accepts a bare array or a DRF page', async () => {
    get.mockResolvedValueOnce({ data: [{ id: '1', type: 'text', text: 'a' }] });
    expect((await whatsappChatService.getChatHistory({ contact: 'x' })).messages).toHaveLength(1);

    get.mockResolvedValueOnce({ data: { results: [{ id: '1', type: 'text', text: 'a' }] } });
    expect((await whatsappChatService.getChatHistory({ contact: 'x' })).messages).toHaveLength(1);
  });
});

describe('readConversationWindow', () => {
  it('prefers the canonical reply_window object', () => {
    const w = readConversationWindow({
      reply_window: {
        open: true,
        expires_at: '2026-08-21T10:00:00Z',
        requires_template: false,
        expires_human: 'in 3 hours',
      },
      // Stale flat aliases that must lose to the canonical object.
      reply_window_open: false,
      window_expires_at: '1999-01-01T00:00:00Z',
    });

    expect(w.open).toBe(true);
    expect(w.expiresAt).toBe('2026-08-21T10:00:00Z');
    expect(w.requiresTemplate).toBe(false);
    expect(w.expiresHuman).toBe('in 3 hours');
  });

  it('falls back through every legacy alias for the expiry', () => {
    // This key-name mismatch is why the "closes in 3h" countdown used to render
    // nothing: Laravel emitted reply_window_expires_at, the client read
    // window_expires_at.
    expect(readConversationWindow({ window_expires_at: 'A' }).expiresAt).toBe('A');
    expect(readConversationWindow({ reply_window_expires_at: 'B' }).expiresAt).toBe('B');
    expect(readConversationWindow({ expires_at: 'C' }).expiresAt).toBe('C');
    expect(readConversationWindow({ is_reply_window_open: true }).open).toBe(true);
  });

  it('returns nulls when the backend says nothing', () => {
    expect(readConversationWindow({})).toEqual({
      open: null,
      expiresAt: null,
      requiresTemplate: null,
      expiresHuman: null,
    });
  });
});

describe('sendText', () => {
  it('echoes client_id back onto the confirmed message for dedupe', async () => {
    post.mockResolvedValueOnce({
      data: { message: { id: 'srv-1', wamid: 'w9', type: 'text', text: 'hi', status: 'sent' } },
    });

    const result = await whatsappChatService.sendText({
      contact: '911234567890',
      text: 'hi',
      client_id: 'c-1',
    });

    expect(result.wamid).toBe('w9');
    expect(result.message?.client_id).toBe('c-1');
    expect(result.message?.direction).toBe('out');
  });

  it('handles a bare wamid response with no message body', async () => {
    post.mockResolvedValueOnce({ data: { wamid: 'w10' } });
    const result = await whatsappChatService.sendText({ contact: 'x', text: 'hi' });
    expect(result.wamid).toBe('w10');
  });
});

describe('getConversations', () => {
  it('normalises the list and its last messages', async () => {
    get.mockResolvedValueOnce({
      data: {
        results: [
          {
            wa_id: '911234567890',
            name: 'Ada',
            unread_count: 3,
            last_message: { id: 'm1', type: 'text', text: 'hi', direction: 'in' },
          },
        ],
      },
    });

    const list = await whatsappChatService.getConversations();
    expect(list).toHaveLength(1);
    expect(list[0].wa_id).toBe('911234567890');
    expect(list[0].unread_count).toBe(3);
    expect(list[0].last_message?.text).toBe('hi');
  });
});

describe('media', () => {
  it('fetches through the AUTHENTICATED proxy, never the public Laravel route', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    get.mockResolvedValueOnce({ data: blob, headers: { 'content-type': 'image/png' } });

    global.URL.createObjectURL = vi.fn(() => 'blob:mock') as never;

    const result = await whatsappChatService.fetchMediaObjectUrl('media-1');

    expect(result.mimeType).toBe('image/png');
    const [url] = get.mock.calls[0];
    expect(url).toBe('/whatsapp/media/media-1/');
    // The unauthenticated arbitrary-file-read route must never be used.
    expect(url).not.toContain('/api/');
    expect(url).not.toMatch(/\/media\/\.\./);
  });

  it('encodes the media id so it cannot escape the path', async () => {
    get.mockResolvedValueOnce({ data: new Blob(['x']), headers: {} });
    global.URL.createObjectURL = vi.fn(() => 'blob:mock') as never;
    await whatsappChatService.fetchMediaObjectUrl('../../.env');
    expect(get.mock.calls[0][0]).toBe('/whatsapp/media/..%2F..%2F.env/');
  });
});
