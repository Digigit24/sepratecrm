// src/lib/whatsapp/linkify.tsx
//
// Link/phone/email detection for WhatsApp text bodies.
//
// WhatsApp itself auto-links URLs, phone numbers and email addresses inside
// plain message text; a chat that renders them as inert grey text looks broken.
//
// This deliberately does NOT parse HTML and never sets innerHTML — the message
// body is attacker-controlled (it is literally whatever a stranger typed into
// WhatsApp). We tokenise with a regex and emit React nodes, so injection is
// structurally impossible.

import React from 'react';

/**
 * One pass over the text, matching in priority order:
 *   - http(s):// URLs, or bare www./domain.tld forms
 *   - mailto-able email addresses
 *   - phone numbers (+ optional, 7–15 digits, spaces/dashes/parens allowed)
 *
 * Trailing sentence punctuation is excluded from URL matches so "see foo.com."
 * does not link the full stop.
 */
const TOKEN_RE = new RegExp(
  [
    // URLs
    '(https?:\\/\\/[^\\s<>"]+|www\\.[^\\s<>"]+)',
    // Emails
    '([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,})',
    // Phone numbers
    '(\\+?\\d[\\d\\s().-]{6,18}\\d)',
  ].join('|'),
  'g',
);

/** Punctuation that should never be part of a trailing link. */
const TRAILING_PUNCT = /[.,;:!?)\]}'"]+$/;

export interface LinkifyOptions {
  /** Extra classes for the rendered anchors. */
  className?: string;
}

/**
 * Turn a plain-text message body into React nodes with clickable links.
 *
 * Returns a plain string's worth of nodes; safe to drop straight into JSX.
 */
export function linkify(text: string, options: LinkifyOptions = {}): React.ReactNode {
  if (!text) return null;

  const linkClass =
    options.className ??
    'underline underline-offset-2 text-[#027eb5] hover:text-[#0369a1] break-all';

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  // Fresh lastIndex per call — the regex is module-level and stateful.
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    const [raw] = match;
    const start = match.index;

    // Strip trailing punctuation back out of the match and into the text run.
    const trimmed = raw.replace(TRAILING_PUNCT, '');
    if (!trimmed) continue;
    const tail = raw.slice(trimmed.length);

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    const isUrl = match[1] !== undefined;
    const isEmail = match[2] !== undefined;

    let href: string | null = null;
    if (isUrl) {
      href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    } else if (isEmail) {
      href = `mailto:${trimmed}`;
    } else {
      // Phone: require enough digits to be plausible, else leave as text.
      const digits = trimmed.replace(/\D/g, '');
      href = digits.length >= 8 && digits.length <= 15 ? `tel:${trimmed.replace(/\s/g, '')}` : null;
    }

    if (href) {
      nodes.push(
        <a
          key={`lk-${key++}`}
          href={href}
          target={isUrl ? '_blank' : undefined}
          // noreferrer is what actually severs window.opener; keep both.
          rel={isUrl ? 'noopener noreferrer' : undefined}
          className={linkClass}
          onClick={(e) => e.stopPropagation()}
        >
          {trimmed}
        </a>,
      );
    } else {
      nodes.push(trimmed);
    }

    if (tail) nodes.push(tail);
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length === 1 ? nodes[0] : nodes;
}

/** Convenience component: linkified text that preserves newlines. */
export const LinkifiedText: React.FC<{ text: string | null | undefined; className?: string }> = ({
  text,
  className,
}) => {
  if (!text) return null;
  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {linkify(text)}
    </span>
  );
};
