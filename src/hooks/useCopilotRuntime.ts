// src/hooks/useCopilotRuntime.ts
//
// Single source of truth for the AI copilot runtime. Both the slide-out
// <CopilotPanel /> and the full-page /work route mount this hook, so the SSE
// adapter wiring (JWT + tool/context refs) lives in exactly one place.
//
// Each caller gets its OWN useLocalRuntime instance (and therefore its own
// message history) — that is intentional: the panel and /work are independent
// surfaces, mirroring how ChatProvider.isOpen only governs the panel.

import { useMemo, useRef } from 'react';
import { useLocalRuntime } from '@assistant-ui/react';
import { useChat } from '@/context/ChatProvider';
import { authService } from '@/services/authService';
import { createChatModelAdapter } from '@/lib/aiChatAdapter';

/**
 * Builds the assistant-ui runtime backed by the Django `POST /ai/chat/` SSE
 * endpoint. Must be called inside <ChatProvider> (AppLayout provides it).
 */
export function useCopilotRuntime() {
  const { selectedTool, context } = useChat();

  // Keep refs current so the adapter (created once) always reads the latest
  // tool/context/token at request time without recreating the runtime.
  const toolRef = useRef<string | null>(selectedTool);
  const contextRef = useRef<Record<string, unknown> | null>(context);
  toolRef.current = selectedTool;
  contextRef.current = context;

  const adapter = useMemo(
    () =>
      createChatModelAdapter({
        getToken: () => authService.getAccessToken(),
        getTool: () => toolRef.current,
        getContext: () => contextRef.current,
      }),
    []
  );

  return useLocalRuntime(adapter);
}
