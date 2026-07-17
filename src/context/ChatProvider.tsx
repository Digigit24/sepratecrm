// src/context/ChatProvider.tsx
//
// Global state for the AI copilot panel: open/close, the currently-selected
// tool, and an arbitrary context payload that a "Create with AI" trigger can
// preload before opening the panel. Kept deliberately small — the actual chat
// runtime lives in CopilotPanel; this is just the shell/coordination state.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';

export const DEFAULT_COPILOT_BOT_NAME = 'CRM bot';

export interface CopilotContextPayload {
  [key: string]: unknown;
}

interface OpenWithOptions {
  tool?: string | null;
  context?: CopilotContextPayload | null;
}

interface ChatContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Open the panel with a preselected tool + context in one call. */
  openWith: (opts: OpenWithOptions) => void;
  selectedTool: string | null;
  setSelectedTool: (tool: string | null) => void;
  context: CopilotContextPayload | null;
  setContext: (ctx: CopilotContextPayload | null) => void;
  botName: string;
  saveBotName: (name: string) => Promise<void>;
  botNameSaveState: 'idle' | 'saving' | 'saved' | 'local';
}

const ChatContext = createContext<ChatContextValue | null>(null);

function cleanBotName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  return name || DEFAULT_COPILOT_BOT_NAME;
}

function getStoredBotName(): string {
  const user = authService.getCurrentUser();
  const preferenceName = cleanBotName((user?.preferences as any)?.copilot?.botName);
  if (preferenceName !== DEFAULT_COPILOT_BOT_NAME) return preferenceName;

  const userId = user?.id ?? 'anonymous';
  const localName = localStorage.getItem(`celiyo_copilot_bot_name:${userId}`);
  return cleanBotName(localName);
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [context, setContext] = useState<CopilotContextPayload | null>(null);
  const [botName, setBotName] = useState<string>(() => getStoredBotName());
  const [botNameSaveState, setBotNameSaveState] = useState<'idle' | 'saving' | 'saved' | 'local'>('idle');

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const openWith = useCallback((opts: OpenWithOptions) => {
    if (opts.tool !== undefined) setSelectedTool(opts.tool);
    if (opts.context !== undefined) setContext(opts.context);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const syncBotName = () => setBotName(getStoredBotName());
    window.addEventListener('celiyo:user-updated', syncBotName);
    return () => window.removeEventListener('celiyo:user-updated', syncBotName);
  }, []);

  const saveBotName = useCallback(async (name: string) => {
    const nextName = cleanBotName(name);
    const user = authService.getCurrentUser();
    const userId = user?.id ?? 'anonymous';
    const currentPrefs = authService.getUserPreferences();
    const nextPreferences = {
      ...currentPrefs,
      copilot: {
        ...((currentPrefs as any).copilot || {}),
        botName: nextName,
      },
    };

    setBotName(nextName);
    setBotNameSaveState('saving');

    try {
      const savedUser = await userService.patchCurrentUser({ preferences: nextPreferences } as any);
      authService.updateUserPreferences(savedUser.preferences || nextPreferences);
      localStorage.removeItem(`celiyo_copilot_bot_name:${userId}`);
      setBotNameSaveState('saved');
    } catch {
      localStorage.setItem(`celiyo_copilot_bot_name:${userId}`, nextName);
      authService.updateUserPreferences(nextPreferences);
      setBotNameSaveState('local');
    }
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      isOpen, open, close, toggle, openWith,
      selectedTool, setSelectedTool,
      context, setContext,
      botName, saveBotName, botNameSaveState,
    }),
    [isOpen, open, close, toggle, openWith, selectedTool, context, botName, saveBotName, botNameSaveState]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a <ChatProvider>');
  return ctx;
}
