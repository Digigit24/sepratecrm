// src/components/whatsapp/MessageContent.tsx
//
// THE message renderer. One switch, twelve arms, no gaps:
//
//   text        linkified body
//   image       tap to zoom
//   sticker     transparent, unbounded, no zoom
//   video       inline player
//   audio       waveform + duration
//   document    icon, filename, size, download via the authenticated proxy
//   location    coordinates/name + "open in maps"
//   contacts    vCard card(s)
//   interactive buttons or list, as they appeared to the recipient
//   button      the button the recipient pressed
//   template    header / body / footer / buttons, WhatsApp-style
//   unsupported a calm row that STILL shows any text it had
//
// The two invariants, both load-bearing:
//   1. NEVER blank. Every arm has a fallback, and the default arm is reachable.
//   2. NEVER crash. Malformed payloads are normalised upstream into
//      `type:'unsupported'` rather than throwing here.

import React from 'react';
import { MapPin, User, ExternalLink, List, CornerUpLeft, HelpCircle, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LinkifiedText } from '@/lib/whatsapp/linkify';
import { AuthedImage, AuthedVideo, AuthedAudio, AuthedDocument } from './AuthedMedia';
import {
  renderTemplateBody,
  getTemplateHeaderText,
  getTemplateHeaderMedia,
  getTemplateFooter,
  getTemplateButtons,
  type TemplateSource,
} from '@/lib/whatsapp/renderTemplate';
import type {
  WhatsAppMessage,
  WhatsAppButton,
  WhatsAppContactCard,
} from '@/types/whatsapp/message';

export interface MessageContentProps {
  message: WhatsAppMessage;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small shared pieces
// ─────────────────────────────────────────────────────────────────────────────

const Caption: React.FC<{ text: string | null | undefined }> = ({ text }) =>
  text ? (
    <p className="mt-1 text-sm leading-relaxed text-[#0b141a]">
      <LinkifiedText text={text} />
    </p>
  ) : null;

/** Buttons as WhatsApp draws them: full-width, stacked, divided, blue. */
const ButtonList: React.FC<{ buttons: WhatsAppButton[] }> = ({ buttons }) => (
  <div className="mt-2 flex flex-col border-t border-black/10" data-testid="message-buttons">
    {buttons.map((btn, i) => {
      const isUrl = btn.url && /^https?:\/\//i.test(btn.url);
      const body = (
        <>
          {isUrl ? (
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          ) : btn.phone_number ? (
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="truncate">{btn.text}</span>
        </>
      );

      const classes = cn(
        'flex w-full items-center justify-center gap-2 px-3 py-2.5 text-[14px] text-[#00a5f4]',
        i > 0 && 'border-t border-black/10',
        btn.selected && 'font-semibold',
      );

      // A URL button is a real link. A reply button is inert history — it shows
      // what the recipient was offered; pressing it here would send nothing.
      return isUrl ? (
        <a
          key={i}
          href={btn.url!}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(classes, 'hover:bg-black/5')}
        >
          {body}
        </a>
      ) : (
        <div key={i} className={classes} aria-disabled="true">
          {body}
        </div>
      );
    })}
  </div>
);

const UnsupportedRow: React.FC<{ label: string; text?: string | null }> = ({ label, text }) => (
  <div data-testid="unsupported-message">
    <div className="flex items-center gap-1.5 text-[13px] italic text-muted-foreground">
      <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </div>
    {/* Even when we cannot render the type, whatever text came with it is shown. */}
    {text ? (
      <p className="mt-1 text-sm leading-relaxed text-[#0b141a]">
        <LinkifiedText text={text} />
      </p>
    ) : null}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Location
// ─────────────────────────────────────────────────────────────────────────────

const LocationBubble: React.FC<{ message: WhatsAppMessage }> = ({ message }) => {
  const loc = message.location;
  if (!loc) return <UnsupportedRow label="Location unavailable" text={message.text} />;

  const label = loc.name || loc.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;

  return (
    <div className="min-w-[220px] max-w-[280px]" data-testid="location-message">
      {/* A static-map tile needs a keyed provider we do not have on the client;
          a labelled placeholder + a real "open in maps" link is the honest
          version and always works. */}
      <div className="flex h-[110px] items-center justify-center rounded-md bg-[#dfe5e7]">
        <MapPin className="h-8 w-8 text-[#54656f]" aria-hidden="true" />
      </div>
      <div className="mt-2">
        <p className="text-sm font-medium text-[#0b141a]">{label}</p>
        {loc.address && loc.address !== label ? (
          <p className="text-[12px] text-muted-foreground">{loc.address}</p>
        ) : null}
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
        </p>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[13px] text-[#00a5f4] underline-offset-2 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Open in maps
        </a>
      </div>
      <Caption text={message.text} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Contacts (vCard)
// ─────────────────────────────────────────────────────────────────────────────

const ContactCard: React.FC<{ contact: WhatsAppContactCard }> = ({ contact }) => {
  const name =
    contact.name?.formatted_name ||
    [contact.name?.first_name, contact.name?.last_name].filter(Boolean).join(' ') ||
    'Unknown contact';
  const phone = contact.phones?.find((p) => p.phone)?.phone ?? null;
  const email = contact.emails?.find((e) => e.email)?.email ?? null;
  const org = [contact.org?.title, contact.org?.company].filter(Boolean).join(', ');

  return (
    <div className="flex items-start gap-3 rounded-md bg-black/5 px-3 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80">
        <User className="h-5 w-5 text-[#54656f]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#0b141a]">{name}</p>
        {org ? <p className="truncate text-[12px] text-muted-foreground">{org}</p> : null}
        {phone ? (
          <a
            href={`tel:${phone.replace(/\s/g, '')}`}
            className="mt-0.5 flex items-center gap-1 text-[12px] text-[#00a5f4] hover:underline"
          >
            <Phone className="h-3 w-3" aria-hidden="true" />
            {phone}
          </a>
        ) : null}
        {email ? (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-1 text-[12px] text-[#00a5f4] hover:underline"
          >
            <Mail className="h-3 w-3" aria-hidden="true" />
            <span className="truncate">{email}</span>
          </a>
        ) : null}
      </div>
    </div>
  );
};

const ContactsBubble: React.FC<{ message: WhatsAppMessage }> = ({ message }) => {
  const contacts = message.contacts ?? [];
  if (contacts.length === 0) {
    return <UnsupportedRow label="Contact card unavailable" text={message.text} />;
  }
  return (
    <div className="flex min-w-[220px] max-w-[280px] flex-col gap-1.5" data-testid="contacts-message">
      {contacts.map((c, i) => (
        <ContactCard key={i} contact={c} />
      ))}
      <Caption text={message.text} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Interactive / button
// ─────────────────────────────────────────────────────────────────────────────

const InteractiveBubble: React.FC<{ message: WhatsAppMessage }> = ({ message }) => {
  const iv = message.interactive;

  // A button-type message with no interactive payload is usually a plain reply
  // that only carries the pressed label as text.
  if (!iv) {
    return message.text ? (
      <div data-testid="interactive-message">
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Button reply</span>
        </div>
        <p className="mt-0.5 text-sm text-[#0b141a]">
          <LinkifiedText text={message.text} />
        </p>
      </div>
    ) : (
      <UnsupportedRow label="Interactive message" text={message.text} />
    );
  }

  // A Meta Flow reply: the recipient submitted a form. There is no fixed shape
  // to the payload, so render the submitted key/value pairs rather than dropping
  // the message or dumping raw JSON at the user.
  if (iv.type === 'flow_reply' || iv.type === 'nfm_reply') {
    const entries = Object.entries(iv.data ?? {}).filter(
      ([, v]) => v !== null && v !== undefined && v !== '',
    );
    return (
      <div className="min-w-[200px] max-w-[300px]" data-testid="interactive-message">
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <List className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Form response</span>
        </div>
        {entries.length > 0 ? (
          <dl className="mt-1 space-y-0.5">
            {entries.map(([key, value]) => (
              <div key={key} className="flex gap-2 text-[13px]">
                <dt className="shrink-0 font-medium text-muted-foreground">{key}</dt>
                <dd className="min-w-0 break-words text-[#0b141a]">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-0.5 text-sm text-[#0b141a]">
            <LinkifiedText text={message.text ?? 'Submitted'} />
          </p>
        )}
      </div>
    );
  }

  // The recipient's CHOICE — render what they picked, not the whole menu.
  if (iv.reply) {
    return (
      <div data-testid="interactive-message">
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{iv.type?.includes('list') ? 'List selection' : 'Button reply'}</span>
        </div>
        <p className="mt-0.5 text-sm font-medium text-[#0b141a]">
          {iv.reply.title || message.text || '—'}
        </p>
        {iv.reply.description ? (
          <p className="text-[12px] text-muted-foreground">{iv.reply.description}</p>
        ) : null}
      </div>
    );
  }

  const body = iv.body ?? message.text;
  const hasAnything = iv.header?.text || body || iv.footer || iv.buttons?.length || iv.sections?.length;
  if (!hasAnything) return <UnsupportedRow label="Interactive message" text={message.text} />;

  return (
    <div className="min-w-[220px] max-w-[300px]" data-testid="interactive-message">
      {iv.header?.text ? (
        <p className="text-[15px] font-bold text-[#0b141a]">{iv.header.text}</p>
      ) : null}
      {body ? (
        <p className="mt-1 text-sm leading-relaxed text-[#0b141a]">
          <LinkifiedText text={body} />
        </p>
      ) : null}
      {iv.footer ? <p className="mt-2 text-[12px] text-muted-foreground">{iv.footer}</p> : null}

      {iv.buttons?.length ? <ButtonList buttons={iv.buttons} /> : null}

      {iv.sections?.length ? (
        <div className="mt-2 border-t border-black/10 pt-2" data-testid="interactive-list">
          <div className="flex items-center justify-center gap-2 py-1 text-[14px] text-[#00a5f4]">
            <List className="h-4 w-4" aria-hidden="true" />
            {iv.button_text || 'View options'}
          </div>
          {iv.sections.map((section, si) => (
            <div key={si} className="mt-1">
              {section.title ? (
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </p>
              ) : null}
              <ul className="mt-0.5">
                {section.rows.map((row, ri) => (
                  <li key={ri} className="border-t border-black/5 px-1 py-1.5">
                    <p className="text-[13px] text-[#0b141a]">{row.title}</p>
                    {row.description ? (
                      <p className="text-[11px] text-muted-foreground">{row.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Template
// ─────────────────────────────────────────────────────────────────────────────

const TemplateBubble: React.FC<{ message: WhatsAppMessage }> = ({ message }) => {
  // Reuse the shared renderer that already backs the Inbox and the CRM drawer,
  // so a template looks identical everywhere.
  const source: TemplateSource = {
    template_proforma: message.template
      ? { name: message.template.name ?? undefined, components: message.template.components ?? undefined }
      : null,
    template_components: message.template?.components ?? null,
    template_component_values: (message.template?.component_values as unknown[]) ?? null,
    metadata: message.template?.name ? { template_name: message.template.name } : null,
    text: message.text,
  };

  const headerText = getTemplateHeaderText(source);
  const headerMedia = getTemplateHeaderMedia(source);
  const body = renderTemplateBody(source);
  const footer = getTemplateFooter(source);
  const buttons = getTemplateButtons(source);

  // A template with literally nothing renderable still must not be blank.
  if (!headerText && !headerMedia && !body && !footer && !buttons?.length) {
    return <UnsupportedRow label="Template message" text={message.text} />;
  }

  return (
    <div className="min-w-[220px] max-w-[300px]" data-testid="template-message">
      {headerMedia ? (
        <div className="mb-2">
          {headerMedia.type === 'image' ? (
            <AuthedImage mediaId={headerMedia.url} alt="Template header image" />
          ) : headerMedia.type === 'video' ? (
            <AuthedVideo mediaId={headerMedia.url} />
          ) : (
            <AuthedDocument mediaId={headerMedia.url} filename="Attachment" />
          )}
        </div>
      ) : null}

      {headerText ? <p className="text-[15px] font-bold text-[#0b141a]">{headerText}</p> : null}

      {body ? (
        <p className="mt-1 text-sm leading-relaxed text-[#0b141a]">
          <LinkifiedText text={body} />
        </p>
      ) : null}

      {footer ? <p className="mt-2 text-[12px] text-muted-foreground">{footer}</p> : null}

      {buttons?.length ? <ButtonList buttons={buttons as WhatsAppButton[]} /> : null}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// The dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export const MessageContent: React.FC<MessageContentProps> = ({ message, className }) => {
  const outgoing = message.direction === 'out';

  const content = (() => {
    switch (message.type) {
      case 'text':
        // A text message with no text is degenerate but must still occupy a row.
        return message.text ? (
          <p className="text-sm leading-relaxed text-[#0b141a]" data-testid="text-message">
            <LinkifiedText text={message.text} />
          </p>
        ) : (
          <UnsupportedRow label="Empty message" />
        );

      case 'image':
        return message.media ? (
          <div data-testid="image-message">
            <AuthedImage mediaId={message.media.url} alt={message.media.caption || 'Image'} />
            <Caption text={message.media.caption ?? message.text} />
          </div>
        ) : (
          <UnsupportedRow label="Image unavailable" text={message.text} />
        );

      case 'sticker':
        return message.media ? (
          <div data-testid="sticker-message">
            <AuthedImage mediaId={message.media.url} alt="Sticker" sticker />
          </div>
        ) : (
          <UnsupportedRow label="Sticker unavailable" text={message.text} />
        );

      case 'video':
        return message.media ? (
          <div data-testid="video-message">
            <AuthedVideo mediaId={message.media.url} />
            <Caption text={message.media.caption ?? message.text} />
          </div>
        ) : (
          <UnsupportedRow label="Video unavailable" text={message.text} />
        );

      case 'audio':
        return message.media ? (
          <div data-testid="audio-message">
            <AuthedAudio mediaId={message.media.url} outgoing={outgoing} />
            <Caption text={message.media.caption ?? message.text} />
          </div>
        ) : (
          <UnsupportedRow label="Audio unavailable" text={message.text} />
        );

      case 'document':
        return message.media ? (
          <div data-testid="document-message">
            <AuthedDocument
              mediaId={message.media.url}
              // NOT `|| message.text`: the backend mirrors `media.caption` into
              // `text`, so falling back to it would print the caption as the
              // filename AND again as the caption below.
              filename={message.media.filename || 'Document'}
              size={message.media.size}
              mime={message.media.mime}
            />
            <Caption text={message.media.caption ?? message.text} />
          </div>
        ) : (
          <UnsupportedRow label="Document unavailable" text={message.text} />
        );

      case 'location':
        return <LocationBubble message={message} />;

      case 'contacts':
        return <ContactsBubble message={message} />;

      case 'interactive':
      case 'button':
        return <InteractiveBubble message={message} />;

      case 'template':
        return <TemplateBubble message={message} />;

      case 'unsupported':
      default:
        // The catch-all. `raw_type` tells the user WHAT we could not draw, which
        // is far more useful than a silent gap in the transcript.
        return (
          <UnsupportedRow
            label={
              message.raw_type
                ? `Unsupported message (${message.raw_type})`
                : 'Unsupported message'
            }
            text={message.text}
          />
        );
    }
  })();

  return (
    <div className={cn('min-w-0', className)} data-message-type={message.type}>
      {content}
    </div>
  );
};

export default MessageContent;
