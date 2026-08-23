// src/types/whatsapp/__tests__/message.test.ts
import { describe, it, expect } from 'vitest';
import {
  normaliseWhatsAppMessage,
  normaliseWhatsAppMessages,
  mergeWhatsAppMessages,
  sortWhatsAppMessages,
  WHATSAPP_MESSAGE_TYPES,
  type WhatsAppMessage,
} from '@/types/whatsapp/message';

describe('normaliseWhatsAppMessage', () => {
  it('never throws and never returns null for hostile input', () => {
    const inputs: unknown[] = [
      null,
      undefined,
      0,
      '',
      'a string',
      [],
      {},
      { type: {} },
      { type: [] },
      { timestamp: 'not-a-date' },
      { media: 'not-an-object' },
      { contacts: 'nope' },
      { interactive: 42 },
      { template: [] },
    ];

    for (const input of inputs) {
      const msg = normaliseWhatsAppMessage(input);
      expect(msg).toBeTruthy();
      expect(typeof msg.id).toBe('string');
      expect(WHATSAPP_MESSAGE_TYPES).toContain(msg.type);
      // The timestamp must always be parseable — a NaN date crashes formatters.
      expect(Number.isNaN(new Date(msg.timestamp).getTime())).toBe(false);
    }
  });

  it('maps the contract envelope through verbatim', () => {
    const msg = normaliseWhatsAppMessage({
      id: 'row-1',
      wamid: 'wamid.ABC',
      direction: 'out',
      type: 'text',
      status: 'delivered',
      timestamp: '2026-08-20T10:00:00Z',
      text: 'hello',
      reply_to: 'wamid.PREV',
      error: null,
    });

    expect(msg.id).toBe('row-1');
    expect(msg.wamid).toBe('wamid.ABC');
    expect(msg.direction).toBe('out');
    expect(msg.type).toBe('text');
    expect(msg.status).toBe('delivered');
    expect(msg.text).toBe('hello');
    expect(msg.reply_to).toBe('wamid.PREV');
  });

  it('understands legacy direction spellings', () => {
    expect(normaliseWhatsAppMessage({ direction: 'incoming' }).direction).toBe('in');
    expect(normaliseWhatsAppMessage({ direction: 'outbound' }).direction).toBe('out');
    expect(normaliseWhatsAppMessage({ is_incoming_message: true }).direction).toBe('in');
    expect(normaliseWhatsAppMessage({ is_incoming_message: 0 }).direction).toBe('out');
    expect(normaliseWhatsAppMessage({ from: 'me' }).direction).toBe('out');
  });

  it('suppresses delivery status on inbound messages', () => {
    // Ticks on a received message read as a rendering bug.
    const inbound = normaliseWhatsAppMessage({ direction: 'in', status: 'read', type: 'text' });
    expect(inbound.status).toBeNull();
  });

  it('normalises status aliases', () => {
    expect(normaliseWhatsAppMessage({ direction: 'out', status: 'queued' }).status).toBe('pending');
    expect(normaliseWhatsAppMessage({ direction: 'out', status: 'SEEN' }).status).toBe('read');
    expect(normaliseWhatsAppMessage({ direction: 'out', status: 'undelivered' }).status).toBe('failed');
    expect(normaliseWhatsAppMessage({ direction: 'out', status: 'wat' }).status).toBeNull();
  });

  it('coerces unix timestamps', () => {
    const seconds = normaliseWhatsAppMessage({ timestamp: '1755676800' });
    expect(new Date(seconds.timestamp).getUTCFullYear()).toBe(2025);
    const millis = normaliseWhatsAppMessage({ timestamp: 1755676800000 });
    expect(new Date(millis.timestamp).getUTCFullYear()).toBe(2025);
  });

  it('reads media from both the contract and legacy media_values shapes', () => {
    const contract = normaliseWhatsAppMessage({
      type: 'image',
      media: { url: 'media-1', mime: 'image/jpeg', filename: 'a.jpg', caption: 'hi', size: 2048 },
    });
    expect(contract.media).toEqual({
      url: 'media-1',
      mime: 'image/jpeg',
      filename: 'a.jpg',
      caption: 'hi',
      size: 2048,
    });

    const legacy = normaliseWhatsAppMessage({
      type: 'document',
      media_values: { link: 'media-2', file_name: 'b.pdf', type: 'document' },
    });
    expect(legacy.media?.url).toBe('media-2');
    expect(legacy.media?.filename).toBe('b.pdf');
  });

  it('parses location, contacts, interactive and template payloads', () => {
    const loc = normaliseWhatsAppMessage({
      type: 'location',
      location: { latitude: '12.97', longitude: '77.59', name: 'Office' },
    });
    expect(loc.location).toMatchObject({ lat: 12.97, lng: 77.59, name: 'Office' });

    const contacts = normaliseWhatsAppMessage({
      type: 'contacts',
      contacts: [{ name: { formatted_name: 'Ada Lovelace' }, phones: [{ phone: '+911234567890' }] }],
    });
    expect(contacts.contacts).toHaveLength(1);
    expect(contacts.contacts![0].name?.formatted_name).toBe('Ada Lovelace');

    const interactive = normaliseWhatsAppMessage({
      type: 'interactive',
      interactive: {
        type: 'button',
        body: 'Pick one',
        action: { buttons: [{ type: 'reply', reply: { id: 'y', title: 'Yes' } }] },
      },
    });
    expect(interactive.interactive?.body).toBe('Pick one');
    expect(interactive.interactive?.buttons?.[0].text).toBe('Yes');

    const template = normaliseWhatsAppMessage({
      type: 'template',
      template: { name: 'welcome', components: [{ type: 'BODY', text: 'Hi {{1}}' }] },
    });
    expect(template.template?.name).toBe('welcome');
    expect(template.template?.components).toHaveLength(1);
  });

  it("converts Laravel's button map into a button array", () => {
    const msg = normaliseWhatsAppMessage({
      type: 'interactive',
      interaction_message_data: { body_text: 'Choose', buttons: { a: 'Yes', b: 'No' } },
    });
    expect(msg.interactive?.buttons?.map((b) => b.text)).toEqual(['Yes', 'No']);
  });

  it('falls back to unsupported for unknown types but keeps the text', () => {
    const msg = normaliseWhatsAppMessage({ type: 'reaction', text: '👍' });
    expect(msg.type).toBe('unsupported');
    expect(msg.raw_type).toBe('reaction');
    expect(msg.text).toBe('👍');
  });

  it('infers a type when the backend declares none', () => {
    expect(normaliseWhatsAppMessage({ text: 'hi' }).type).toBe('text');
    expect(normaliseWhatsAppMessage({ location: { lat: 1, lng: 2 } }).type).toBe('location');
    expect(normaliseWhatsAppMessage({ media: { url: 'x', mime: 'video/mp4' } }).type).toBe('video');
    expect(normaliseWhatsAppMessage({}).type).toBe('unsupported');
  });

  it('maps voice/ptt onto audio', () => {
    expect(normaliseWhatsAppMessage({ type: 'voice' }).type).toBe('audio');
    expect(normaliseWhatsAppMessage({ type: 'ptt' }).type).toBe('audio');
  });

  it('normalises a list without dropping rows', () => {
    expect(normaliseWhatsAppMessages([{ text: 'a' }, null, 5]).length).toBe(3);
    expect(normaliseWhatsAppMessages('nope')).toEqual([]);
  });
});

const msg = (over: Partial<WhatsAppMessage>): WhatsAppMessage =>
  normaliseWhatsAppMessage({
    direction: 'out',
    type: 'text',
    timestamp: '2026-08-20T10:00:00Z',
    ...over,
  });

describe('mergeWhatsAppMessages — realtime dedupe', () => {
  it('collapses an optimistic echo and its broadcast on wamid', () => {
    // The echo already knows its wamid (the send response returned it) and the
    // Pusher broadcast arrives moments later carrying the same one.
    const echo = msg({ id: 'local-1', client_id: 'c1', wamid: 'wamid.X', status: 'sent', text: 'hi' });
    const broadcast = msg({ id: 'server-9', wamid: 'wamid.X', status: 'delivered', text: 'hi' });

    const merged = mergeWhatsAppMessages([echo], [broadcast]);

    expect(merged).toHaveLength(1);
    expect(merged[0].wamid).toBe('wamid.X');
    expect(merged[0].status).toBe('delivered');
    // The client id survives so any LATER broadcast still matches this row.
    expect(merged[0].client_id).toBe('c1');
  });

  it('collapses on client_id when the echo has no wamid yet', () => {
    const echo = msg({ id: 'local-1', client_id: 'c2', status: 'pending', pending: true, text: 'hi' });
    const confirmed = msg({ id: 'server-3', client_id: 'c2', wamid: 'wamid.Y', status: 'sent', text: 'hi' });

    const merged = mergeWhatsAppMessages([echo], [confirmed]);

    expect(merged).toHaveLength(1);
    expect(merged[0].wamid).toBe('wamid.Y');
    expect(merged[0].pending).toBe(false);
  });

  it('collapses a THREE-way collision: echo, send response, broadcast', () => {
    const echo = msg({ id: 'local-1', client_id: 'c3', status: 'pending', pending: true, text: 'hi' });
    const response = msg({ id: 'local-1', client_id: 'c3', wamid: 'wamid.Z', status: 'sent', text: 'hi' });
    const broadcast = msg({ id: 'server-7', wamid: 'wamid.Z', status: 'read', text: 'hi' });

    const afterResponse = mergeWhatsAppMessages([echo], [response]);
    const afterBroadcast = mergeWhatsAppMessages(afterResponse, [broadcast]);

    expect(afterBroadcast).toHaveLength(1);
    expect(afterBroadcast[0].status).toBe('read');
  });

  it('keeps genuinely distinct messages apart', () => {
    const a = msg({ id: 'a', wamid: 'wamid.A', text: 'one' });
    const b = msg({ id: 'b', wamid: 'wamid.B', text: 'two' });
    expect(mergeWhatsAppMessages([a], [b])).toHaveLength(2);
  });

  it('is idempotent — replaying the same broadcast adds nothing', () => {
    const a = msg({ id: 'a', wamid: 'wamid.A', text: 'one' });
    const once = mergeWhatsAppMessages([], [a]);
    const twice = mergeWhatsAppMessages(once, [a]);
    const thrice = mergeWhatsAppMessages(twice, [a]);
    expect(thrice).toHaveLength(1);
  });

  it('never regresses a confirmed row back to pending', () => {
    const confirmed = msg({ id: 'a', wamid: 'w', status: 'delivered', pending: false });
    const latePending = msg({ id: 'a', wamid: 'w', status: 'pending', pending: true });
    const merged = mergeWhatsAppMessages([confirmed], [latePending]);
    expect(merged[0].pending).toBe(false);
  });

  it('returns the existing list untouched when nothing arrives', () => {
    const existing = [msg({ id: 'a' })];
    expect(mergeWhatsAppMessages(existing, [])).toBe(existing);
  });

  it('keeps the transcript in chronological order', () => {
    const older = msg({ id: 'a', timestamp: '2026-08-20T09:00:00Z' });
    const newer = msg({ id: 'b', timestamp: '2026-08-20T11:00:00Z' });
    const merged = mergeWhatsAppMessages([newer], [older]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('sortWhatsAppMessages', () => {
  it('sorts newest last and does not mutate the input', () => {
    const input = [
      msg({ id: 'c', timestamp: '2026-08-20T12:00:00Z' }),
      msg({ id: 'a', timestamp: '2026-08-20T10:00:00Z' }),
      msg({ id: 'b', timestamp: '2026-08-20T11:00:00Z' }),
    ];
    const sorted = sortWhatsAppMessages(input);
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(input[0].id).toBe('c');
  });
});
