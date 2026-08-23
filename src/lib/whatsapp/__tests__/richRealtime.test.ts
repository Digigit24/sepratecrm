// src/lib/whatsapp/__tests__/richRealtime.test.ts
//
// The rules that decide whether a socket payload can be rendered as-is or has
// to be fetched. Getting these wrong is expensive in opposite directions:
// too eager and we render a truncated message as if it were complete; too timid
// and we refetch every message, which is the cost this change exists to remove.

import { describe, it, expect } from 'vitest';
import {
  readRichMessage,
  needsSingleMessageRefetch,
  envelopeToCacheRow,
  mergeRowIntoMessages,
  messageIdentities,
} from '@/lib/whatsapp/richRealtime';

/** A DigicrmMessage payload exactly as the backend publishes it. */
const richPayload = (message: Record<string, unknown>) => ({
  message: {
    id: 'msg-uid-0001',
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
    ...message,
  },
  contact: '919876543210',
  contact_uid: 'contact-uid-1',
});

describe('readRichMessage', () => {
  it('reads the pinned envelope straight off the wire', () => {
    const event = readRichMessage(richPayload({}));

    expect(event).not.toBeNull();
    expect(event!.message.wamid).toBe('wamid.AAA');
    expect(event!.message.text).toBe('hello there');
    expect(event!.message.direction).toBe('in');
    expect(event!.contactWaId).toBe('919876543210');
    expect(event!.contactUid).toBe('contact-uid-1');
    expect(event!.truncated).toBe(false);
  });

  it('keeps media, location and interactive blocks intact', () => {
    const event = readRichMessage(richPayload({
      type: 'image',
      media: { url: 'media/abc.jpg', mime: 'image/jpeg', filename: 'roof.jpg', caption: 'the roof' },
    }));

    expect(event!.message.type).toBe('image');
    expect(event!.message.media?.url).toBe('media/abc.jpg');
    expect(event!.message.media?.caption).toBe('the roof');
  });

  it('returns null for a payload carrying no message', () => {
    expect(readRichMessage({ contact: '919876543210' })).toBeNull();
    expect(readRichMessage({ message: {} })).toBeNull();
    expect(readRichMessage(null)).toBeNull();
    expect(readRichMessage('nonsense')).toBeNull();
  });

  it('surfaces the truncated flag the server sets past Pusher\'s 10KB limit', () => {
    const event = readRichMessage(richPayload({ truncated: true }));
    expect(event!.truncated).toBe(true);
  });
});

describe('needsSingleMessageRefetch', () => {
  const decide = (message: Record<string, unknown>) =>
    needsSingleMessageRefetch(readRichMessage(richPayload(message))!);

  it('renders a complete text message without fetching', () => {
    expect(decide({})).toBe(false);
  });

  it('renders a complete media message without fetching', () => {
    expect(decide({
      type: 'image',
      media: { url: 'media/abc.jpg', mime: 'image/jpeg' },
    })).toBe(false);
  });

  it('fetches when the server truncated the payload', () => {
    expect(decide({ truncated: true })).toBe(true);
  });

  it('fetches when the type promises media that is not there (the n8n gap)', () => {
    expect(decide({ type: 'image', media: null })).toBe(true);
    expect(decide({ type: 'document', media: null })).toBe(true);
  });

  it('fetches when a location, contacts or template block is missing', () => {
    expect(decide({ type: 'location', location: null })).toBe(true);
    expect(decide({ type: 'contacts', contacts: null })).toBe(true);
    expect(decide({ type: 'template', template: null })).toBe(true);
  });

  it('fetches a text envelope with no text at all', () => {
    expect(decide({ type: 'text', text: null })).toBe(true);
  });
});

describe('envelopeToCacheRow', () => {
  it('writes BOTH the envelope and the legacy aliases', () => {
    const event = readRichMessage(richPayload({
      type: 'image',
      media: { url: 'media/abc.jpg', mime: 'image/jpeg', caption: 'roof' },
    }))!;

    const row = envelopeToCacheRow(event.message, 'contact-uid-1');

    // Legacy aliases, read by the useMessages transform.
    expect(row._uid).toBe('msg-uid-0001');
    expect(row.is_incoming_message).toBe(true);
    expect(row.messaged_at).toBe('2026-08-24T10:30:00.000Z');
    expect(row.contact_uid).toBe('contact-uid-1');
    // Envelope fields, preferred by normaliseWhatsAppMessage in ChatWindow.
    expect(row.wamid).toBe('wamid.AAA');
    expect(row.type).toBe('image');
    expect((row.media as { url: string }).url).toBe('media/abc.jpg');
  });
});

describe('dedupe across the three sightings of one message', () => {
  it('collapses an optimistic echo, a thin-event refetch and a rich event into ONE row', () => {
    // 1. The user sends. Only a client_id exists.
    let messages: Record<string, unknown>[] = [
      { id: 'temp_1', client_id: 'cid-1', message_body: 'hi', status: 'pending' },
    ];

    // 2. The refetch triggered by Laravel's thin event returns the server row,
    //    which echoes the client_id back and now has a wamid.
    messages = mergeRowIntoMessages(messages, {
      _uid: 'server-1', client_id: 'cid-1', wamid: 'wamid.OUT1', status: 'sent',
    });
    expect(messages).toHaveLength(1);

    // 3. DigiCRM's rich event for the same message, keyed only on the wamid.
    messages = mergeRowIntoMessages(messages, {
      id: 'server-1', wamid: 'wamid.OUT1', text: 'hi', status: 'delivered',
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].wamid).toBe('wamid.OUT1');
    expect(messages[0].client_id).toBe('cid-1');
    expect(messages[0].status).toBe('delivered');
  });

  it('matches on wamid even when the ids differ', () => {
    const messages = mergeRowIntoMessages<Record<string, unknown>>(
      [{ id: 'local-abc', wamid: 'wamid.SAME' }],
      { id: 'server-xyz', wamid: 'wamid.SAME', text: 'body' },
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe('body');
  });

  it('never loses an identity a previous sighting established', () => {
    const messages = mergeRowIntoMessages<Record<string, unknown>>(
      [{ id: 'temp_1', client_id: 'cid-9' }],
      { id: 'temp_1', wamid: 'wamid.NEW' },
    );

    expect(messages[0].client_id).toBe('cid-9');
    expect(messages[0].wamid).toBe('wamid.NEW');
  });

  it('appends a genuinely different message', () => {
    const messages = mergeRowIntoMessages(
      [{ id: 'a', wamid: 'wamid.A' }],
      { id: 'b', wamid: 'wamid.B' },
    );
    expect(messages).toHaveLength(2);
  });

  it('ranks identities wamid before client_id before id', () => {
    expect(messageIdentities({ wamid: 'w', client_id: 'c', _uid: 'i' })).toEqual([
      'wamid:w', 'cid:c', 'id:i',
    ]);
    expect(messageIdentities({})).toEqual([]);
  });
});
