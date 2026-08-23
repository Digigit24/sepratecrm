// src/components/whatsapp/LinkifiedText.tsx
//
// Linkified message text that preserves the sender's newlines.
//
// Lives apart from lib/whatsapp/linkify.tsx so that module can stay a pure
// helper module: a file that exports BOTH a component and plain functions
// breaks Fast Refresh for everything that imports it.

import React from 'react';
import { linkify } from '@/lib/whatsapp/linkify';

export interface LinkifiedTextProps {
  text: string | null | undefined;
  className?: string;
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ text, className }) => {
  if (!text) return null;
  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {linkify(text)}
    </span>
  );
};

export default LinkifiedText;
