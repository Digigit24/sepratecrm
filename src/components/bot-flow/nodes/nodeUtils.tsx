// src/components/bot-flow/nodes/nodeUtils.tsx
// Shared node utilities, colors, and base component

import React from 'react';
import { MessageSquare, Image, LayoutGrid, ExternalLink, List, FileText, Keyboard, Zap } from 'lucide-react';
import type { MessageType } from '@/types/botFlowTypes';

export const NODE_COLORS: Record<MessageType | 'start', string> = {
  start: '#3b82f6',
  simple: '#22c55e',
  media: '#a855f7',
  interactive: '#f97316',
  template: '#ec4899',
  collect_input: '#ef4444',
};

export const NODE_LABELS: Record<MessageType | 'start', string> = {
  start: 'START',
  simple: 'SIMPLE MESSAGE',
  media: 'MEDIA',
  interactive: 'INTERACTIVE',
  template: 'TEMPLATE',
  collect_input: 'COLLECT INPUT',
};

export const NODE_ICONS: Record<MessageType | 'start', React.ElementType> = {
  start: Zap,
  simple: MessageSquare,
  media: Image,
  interactive: LayoutGrid,
  template: FileText,
  collect_input: Keyboard,
};

export const NODE_TYPES_LIST = [
  { type: 'simple', label: 'Simple Message', icon: MessageSquare, color: '#22c55e', description: 'Send a text message' },
  { type: 'media', label: 'Media Message', icon: Image, color: '#a855f7', description: 'Send image/video/audio/document' },
  { type: 'interactive', label: 'Interactive Buttons', icon: LayoutGrid, color: '#f97316', description: 'Message with reply buttons' },
  { type: 'interactive_cta', label: 'CTA URL Button', icon: ExternalLink, color: '#06b6d4', description: 'Message with a URL button' },
  { type: 'interactive_list', label: 'List Message', icon: List, color: '#eab308', description: 'Message with a list menu' },
  { type: 'template', label: 'Template', icon: FileText, color: '#ec4899', description: 'Send a WhatsApp template' },
  { type: 'collect_input', label: 'Collect Input', icon: Keyboard, color: '#ef4444', description: 'Ask a question and collect response' },
] as const;
