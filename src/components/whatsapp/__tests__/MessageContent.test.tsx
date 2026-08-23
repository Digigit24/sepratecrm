// src/components/whatsapp/__tests__/MessageContent.test.tsx
//
// The contract this file enforces: EVERY message type renders something.
// Never blank, never a crash. The parameterised sweep at the bottom is the
// regression net — add a type to the envelope and this test fails until it has
// a renderer.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Media is fetched through the authenticated proxy; stub the transport so the
// component tree resolves synchronously and nothing hits the network.
vi.mock('@/services/whatsappChatService', () => ({
  whatsappChatService: {
    fetchMediaObjectUrl: vi.fn().mockResolvedValue({
      url: 'blob:mock-media',
      mimeType: 'application/octet-stream',
    }),
  },
  isWhatsappEndpointUnavailable: () => false,
}));

import { MessageContent } from '@/components/whatsapp/MessageContent';
import {
  normaliseWhatsAppMessage,
  WHATSAPP_MESSAGE_TYPES,
  type WhatsAppMessageType,
} from '@/types/whatsapp/message';

beforeEach(() => {
  vi.clearAllMocks();
});

/** A representative, realistic payload for each of the 11 types + unsupported. */
const FIXTURES: Record<WhatsAppMessageType, Record<string, unknown>> = {
  text: {
    type: 'text',
    text: 'Hello there, see https://celiyo.com for details',
  },
  image: {
    type: 'image',
    media: { url: 'media-img-1', mime: 'image/jpeg', caption: 'A photo caption' },
  },
  video: {
    type: 'video',
    media: { url: 'media-vid-1', mime: 'video/mp4', caption: 'A clip' },
  },
  audio: {
    type: 'audio',
    media: { url: 'media-aud-1', mime: 'audio/ogg' },
  },
  document: {
    type: 'document',
    media: {
      url: 'media-doc-1',
      mime: 'application/pdf',
      filename: 'invoice-2026.pdf',
      size: 245_760,
    },
  },
  sticker: {
    type: 'sticker',
    media: { url: 'media-stk-1', mime: 'image/webp' },
  },
  location: {
    type: 'location',
    location: { lat: 12.9716, lng: 77.5946, name: 'Celiyo HQ', address: 'Bengaluru' },
  },
  contacts: {
    type: 'contacts',
    contacts: [
      {
        name: { formatted_name: 'Ada Lovelace' },
        phones: [{ phone: '+911234567890', type: 'WORK' }],
        emails: [{ email: 'ada@example.com' }],
        org: { company: 'Analytical Engines', title: 'Engineer' },
      },
    ],
  },
  interactive: {
    type: 'interactive',
    interactive: {
      type: 'button',
      header: 'Confirm booking',
      body: 'Shall we hold your slot?',
      footer: 'Reply within 24h',
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'yes', title: 'Yes please' } },
          { type: 'reply', reply: { id: 'no', title: 'No thanks' } },
        ],
      },
    },
  },
  button: {
    type: 'button',
    text: 'Yes please',
    interactive: { type: 'button_reply', reply: { id: 'yes', title: 'Yes please' } },
  },
  template: {
    type: 'template',
    template: {
      name: 'appointment_reminder',
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Appointment reminder' },
        { type: 'BODY', text: 'Hi {{1}}, your appointment is on {{2}}.' },
        { type: 'FOOTER', text: 'Celiyo Clinic' },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'URL', text: 'Reschedule', url: 'https://celiyo.com/reschedule' },
            { type: 'QUICK_REPLY', text: 'Confirm' },
          ],
        },
      ],
      component_values: [
        { type: 'body', parameters: { '{{1}}': { text: 'Ada' }, '{{2}}': { text: 'Friday' } } },
      ],
    },
  },
  unsupported: {
    type: 'reaction',
    text: '👍',
  },
};

describe('MessageContent — every type renders', () => {
  it.each(WHATSAPP_MESSAGE_TYPES)('renders a %s message without crashing or blanking', (type) => {
    const message = normaliseWhatsAppMessage({
      id: `row-${type}`,
      direction: 'in',
      timestamp: '2026-08-20T10:00:00Z',
      ...FIXTURES[type],
    });

    const { container } = render(<MessageContent message={message} />);

    // The dispatcher must have chosen an arm — no silent pass-through.
    const root = container.querySelector('[data-message-type]');
    expect(root).not.toBeNull();

    // NEVER blank: there is always either visible text or a rendered element.
    const hasText = (root!.textContent ?? '').trim().length > 0;
    const hasElement = root!.querySelector('img, video, audio, svg, a, button, ul, li') !== null;
    expect(hasText || hasElement).toBe(true);
  });

  it('covers all 12 arms of the dispatcher', () => {
    // Guards against a type being added to the envelope with no fixture here.
    expect(Object.keys(FIXTURES).sort()).toEqual([...WHATSAPP_MESSAGE_TYPES].sort());
  });
});

describe('MessageContent — per-type detail', () => {
  const renderType = (type: WhatsAppMessageType, extra: Record<string, unknown> = {}) =>
    render(
      <MessageContent
        message={normaliseWhatsAppMessage({
          id: `row-${type}`,
          direction: 'in',
          timestamp: '2026-08-20T10:00:00Z',
          ...FIXTURES[type],
          ...extra,
        })}
      />,
    );

  it('linkifies URLs in text without using innerHTML', () => {
    renderType('text');
    const link = screen.getByRole('link', { name: /celiyo\.com/i });
    expect(link).toHaveAttribute('href', 'https://celiyo.com');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('does not linkify text that merely looks like markup', () => {
    render(
      <MessageContent
        message={normaliseWhatsAppMessage({
          type: 'text',
          direction: 'in',
          text: '<img src=x onerror=alert(1)>',
        })}
      />,
    );
    // Rendered as literal text, not as an element.
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('renders a location with coordinates and an open-in-maps link', () => {
    renderType('location');
    expect(screen.getByText('Celiyo HQ')).toBeInTheDocument();
    expect(screen.getByText(/12\.971600, 77\.594600/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /open in maps/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('12.9716,77.5946'));
  });

  it('renders a contact card with name, phone and email', () => {
    renderType('contacts');
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('+911234567890')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Engineer, Analytical Engines/)).toBeInTheDocument();
  });

  it('renders interactive buttons as they appeared', () => {
    renderType('interactive');
    expect(screen.getByText('Confirm booking')).toBeInTheDocument();
    expect(screen.getByText('Shall we hold your slot?')).toBeInTheDocument();
    expect(screen.getByText('Reply within 24h')).toBeInTheDocument();
    expect(screen.getByText('Yes please')).toBeInTheDocument();
    expect(screen.getByText('No thanks')).toBeInTheDocument();
  });

  it('renders a button reply as the chosen option', () => {
    renderType('button');
    expect(screen.getByText(/button reply/i)).toBeInTheDocument();
    expect(screen.getByText('Yes please')).toBeInTheDocument();
  });

  it('renders a template with header, substituted body, footer and buttons', () => {
    renderType('template');
    expect(screen.getByText('Appointment reminder')).toBeInTheDocument();
    // {{1}} / {{2}} must be replaced by the resolved values.
    expect(screen.getByText(/Hi Ada, your appointment is on Friday\./)).toBeInTheDocument();
    expect(screen.getByText('Celiyo Clinic')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reschedule/ })).toHaveAttribute(
      'href',
      'https://celiyo.com/reschedule',
    );
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('renders a document with filename and human-readable size', () => {
    renderType('document');
    expect(screen.getByText('invoice-2026.pdf')).toBeInTheDocument();
    expect(screen.getByText(/PDF · 240 KB/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download invoice-2026\.pdf/i })).toBeInTheDocument();
  });

  it('shows the unsupported row WITH its text rather than a blank bubble', () => {
    renderType('unsupported');
    expect(screen.getByTestId('unsupported-message')).toBeInTheDocument();
    expect(screen.getByText(/Unsupported message \(reaction\)/)).toBeInTheDocument();
    // The salvageable text still shows.
    expect(screen.getByText('👍')).toBeInTheDocument();
  });

  it('degrades a media type whose payload is missing instead of blanking', () => {
    for (const type of ['image', 'video', 'audio', 'document', 'sticker'] as const) {
      const { container, unmount } = render(
        <MessageContent
          message={normaliseWhatsAppMessage({
            type,
            direction: 'in',
            text: 'caption survived',
            // no media at all
          })}
        />,
      );
      expect(container.textContent).toContain('caption survived');
      unmount();
    }
  });
});
