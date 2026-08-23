// src/services/__tests__/pusherService.test.ts
//
// The realtime chain only works if the frontend takes the connection details
// FROM THE GRANT. Two ways it has broken before, both silent:
//
//   * the app key was hardcoded, so a backend pointed at a different Pusher app
//     signed `auth` strings that the socket rejected as bad signatures;
//   * the channel name was rebuilt client-side without the `private-` prefix.
//
// Plus one latent one this pins down: stripping the leading dot off
// `echo_event` with /^./ (unescaped) eats the first CHARACTER, not the dot, so
// an `echo_event` without a leading dot binds a mangled event name.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getRealtimeGrant = vi.fn();

vi.mock('@/services/whatsappChatService', async () => {
  const actual = await vi.importActual<typeof import('@/services/whatsappChatService')>(
    '@/services/whatsappChatService',
  );
  return {
    ...actual,
    whatsappChatService: { getRealtimeGrant: (...a: unknown[]) => getRealtimeGrant(...a) },
  };
});

// Captured Echo construction + the fake channel it hands back.
let echoOptions: Record<string, unknown> | null = null;
const subscribe = vi.fn();
const boundEvents: string[] = [];

vi.mock('laravel-echo', () => ({
  default: class FakeEcho {
    connector: unknown;
    constructor(options: Record<string, unknown>) {
      echoOptions = options;
      this.connector = { pusher: { connection: { bind: vi.fn() }, subscribe, unsubscribe: vi.fn() } };
    }
    disconnect() {}
  },
}));

vi.mock('pusher-js', () => ({ default: class FakePusher {} }));

const GRANT = {
  key: 'grant-app-key',
  cluster: 'eu',
  channel: 'private-vendor-channel.abc123',
  event: 'VendorChannelBroadcast',
  echo_event: '.VendorChannelBroadcast',
  auth: null,
  channel_data: null,
  host: null,
  port: null,
  force_tls: null,
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const load = async () => {
  vi.resetModules();
  echoOptions = null;
  boundEvents.length = 0;
  subscribe.mockReturnValue({
    bind: (name: string) => boundEvents.push(name),
    unbind_all: vi.fn(),
  });
  return import('@/services/pusherService');
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subscribeToVendorChannel', () => {
  it('connects with the app key and cluster the GRANT names, not a hardcoded one', async () => {
    getRealtimeGrant.mockResolvedValue(GRANT);
    const { subscribeToVendorChannel } = await load();

    subscribeToVendorChannel('abc123', {});
    await flush();

    expect(echoOptions).toMatchObject({ key: 'grant-app-key', cluster: 'eu' });
  });

  it('subscribes to the granted channel VERBATIM, private- prefix and all', async () => {
    getRealtimeGrant.mockResolvedValue(GRANT);
    const { subscribeToVendorChannel } = await load();

    subscribeToVendorChannel('abc123', {});
    await flush();

    expect(subscribe).toHaveBeenCalledWith('private-vendor-channel.abc123');
  });

  it('binds the granted event in both raw and dotted form', async () => {
    getRealtimeGrant.mockResolvedValue(GRANT);
    const { subscribeToVendorChannel } = await load();

    subscribeToVendorChannel('abc123', {});
    await flush();

    expect(boundEvents).toContain('VendorChannelBroadcast');
    expect(boundEvents).toContain('.VendorChannelBroadcast');
  });

  it('does not mangle an echo_event that arrives WITHOUT a leading dot', async () => {
    getRealtimeGrant.mockResolvedValue({ ...GRANT, event: null, echo_event: 'VendorChannelBroadcast' });
    const { subscribeToVendorChannel } = await load();

    subscribeToVendorChannel('abc123', {});
    await flush();

    // /^./ instead of /^\./ would have bound "endorChannelBroadcast".
    expect(boundEvents).toContain('VendorChannelBroadcast');
    expect(boundEvents.some(name => name.includes('endorChannelBroadcast') && !name.includes('V'))).toBe(false);
  });

  it('never subscribes when the grant names no channel', async () => {
    getRealtimeGrant.mockResolvedValue({ ...GRANT, channel: '' });
    const { subscribeToVendorChannel } = await load();

    subscribeToVendorChannel('abc123', {});
    await flush();

    expect(subscribe).not.toHaveBeenCalled();
  });
});
